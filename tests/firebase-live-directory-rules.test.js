"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { before, test } = require("node:test");

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, "../firebase/database.rules.json"), "utf8")).rules;
const directory = rules.publicLiveDirectory;

test("Firebase directory adds only a dedicated public branch and keeps existing rules unchanged", () => {
  const existing = { rules: { ...rules } };
  delete existing.rules.publicLiveDirectory;
  assert.equal(crypto.createHash("sha256").update(JSON.stringify(existing)).digest("hex"),
    "03b28d080731bc55be77e6a1b74024666a5880fbc13a2778b367a4b82c1205b4");
  assert.equal(rules.users.$uid[".read"], "auth != null && auth.uid == $uid");
  assert.equal(rules.serverOnly[".read"], false);
});

test("Firebase directory rules require indexed bounded queries and owner-only individual access", () => {
  assert.equal(directory[".indexOn"], "updatedAt");
  assert.match(directory[".read"], /query\.orderByChild == 'updatedAt'/);
  assert.match(directory[".read"], /query\.startAt != null/);
  assert.match(directory[".read"], /query\.limitToLast <= 100/);
  // A fixed SSE startAt must not be invalidated by a sliding lower bound in Security Rules.
  assert.doesNotMatch(directory[".read"], /query\.startAt >= now/);
  assert.equal(directory.$uid[".read"], "auth != null && auth.uid == $uid");
  assert.equal(directory.$uid[".write"], "auth != null && auth.uid == $uid");
});

test("Firebase directory validates exact protocol fields and never grants private account reads", () => {
  const entry = directory.$uid;
  assert.equal(entry.$other[".validate"], false);
  assert.match(entry[".validate"], /protocolVersion.*instanceId.*updatedAt.*streams/);
  assert.equal(entry.protocolVersion[".validate"], "newData.val() == 1");
  assert.match(entry.updatedAt[".validate"], /now - 5000.*now \+ 5000/);
  assert.equal(entry.streams.$other[".validate"], false);
  assert.match(entry.streams[".validate"], /hasChild\('tiktok'\).*hasChild\('kick'\)/);
  for (const platform of ["tiktok", "kick"]) {
    const stream = entry.streams[platform];
    assert.equal(stream.$other[".validate"], false);
    assert.match(stream[".validate"], /username.*avatarUrl/);
    assert.match(stream.avatarUrl[".validate"], /https/);
    assert.match(stream.avatarUrl[".validate"], /length <= 1000/);
    assert.match(stream.viewers[".validate"], /1000000000/);
    assert.match(stream.viewers[".validate"], /% 1 == 0/);
  }
});

test("Directory privacy explains public UID, explicit opt-in, expiry and unverified platform identity", () => {
  const privacy = fs.readFileSync(path.join(__dirname, "../PRIVACY.md"), "utf8");
  for (const text of ["désactivée par défaut", "activation explicite", "clé publique", "90 secondes", "ne certifie", "Aucun e-mail"]) {
    assert.ok(privacy.includes(text), text);
  }
});

// Real Security Rules validation (no cloud access):
// Start the Firebase Database emulator on localhost, then run this file with
// FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:PORT. The before hook installs these
// rules in the isolated demo-shenpulse-directory namespace, never a cloud DB.
const emulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (emulatorHost) {
  const emulatorOrigin = new URL(`http://${emulatorHost}`);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(emulatorOrigin.hostname), "Security tests must only target a local emulator");
  const projectId = "demo-shenpulse-directory";
  const prefix = `directory-test-${process.pid}`;
  const ownerUid = `${prefix}-owner`;
  const attackerUid = `${prefix}-attacker`;
  const instanceId = "11111111-1111-4111-8111-111111111111";
  const freshEntry = (streams = { tiktok: { username: "creator.test", avatarUrl: "https://cdn.example/avatar.webp", viewers: 0 } }) => ({
    protocolVersion: 1, instanceId, updatedAt: { ".sv": "timestamp" }, streams
  });
  function token(uid) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({
      aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid,
      iat: now, exp: now + 3600, auth_time: now,
      firebase: { sign_in_provider: "password", identities: {} }
    })).toString("base64url");
    return `${header}.${body}.`;
  }
  async function request(location, { method = "GET", uid, body, query = {}, headers = {}, admin = false } = {}) {
    const url = new URL(`${location}.json`, emulatorOrigin);
    url.searchParams.set("ns", projectId);
    if (uid) url.searchParams.set("auth", token(uid));
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      method, headers: { "Content-Type": "application/json", ...(admin ? { Authorization: "Bearer owner" } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000)
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, etag: response.headers.get("etag") };
  }
  const boundedQuery = () => ({ orderBy: JSON.stringify("updatedAt"), startAt: Date.now() - 90000, limitToLast: 100 });
  async function denied(location, options, label) {
    const response = await request(location, options);
    assert.ok(response.status >= 400, `${label}: expected denial, got ${response.status}`);
  }
  before(async () => {
    const response = await request("/.settings/rules", { method: "PUT", admin: true, body: { rules } });
    assert.equal(response.status, 200, `Emulator rejected Security Rules: ${JSON.stringify(response.body)}`);
  });

  test("Emulator: bounded public directory queries succeed while unbounded and wrong queries fail", async () => {
    const seed = await request(`/publicLiveDirectory/${ownerUid}`, { method: "PUT", uid: ownerUid, body: freshEntry() });
    assert.equal(seed.status, 200);
    const publicRead = await request("/publicLiveDirectory", { query: boundedQuery() });
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.body[ownerUid].streams.tiktok.viewers, 0);
    const cutoff = Date.now() - 90000;
    const invalid = [
      {}, { orderBy: JSON.stringify("updatedAt"), limitToLast: 100 },
      { orderBy: JSON.stringify("updatedAt"), startAt: cutoff },
      { orderBy: JSON.stringify("updatedAt"), startAt: cutoff, limitToLast: 101 },
      { orderBy: JSON.stringify("updatedAt"), startAt: cutoff, limitToFirst: 10 },
      { orderBy: JSON.stringify("username"), startAt: cutoff, limitToLast: 100 }
    ];
    for (const query of invalid) await denied("/publicLiveDirectory", { query }, "invalid public query");
    const aheadClock = await request("/publicLiveDirectory", { query: { ...boundedQuery(), startAt: Date.now() + 60000 } });
    assert.equal(aheadClock.status, 200, "Clock skew can yield an empty directory, not permission denial");
    assert.equal(aheadClock.body, null);
    const nonNumericCutoff = await request("/publicLiveDirectory", { query: { ...boundedQuery(), startAt: JSON.stringify("old") } });
    assert.equal(nonNumericCutoff.status, 200);
    assert.equal(nonNumericCutoff.body, null, "Non-numeric bounds yield no numeric timestamp records and do not reveal private data");
  });

  test("Emulator: anonymous and other UID writes fail, individual reads and deletion stay owner-only", async () => {
    const location = `/publicLiveDirectory/${ownerUid}`;
    await denied(location, { method: "PUT", body: freshEntry() }, "anonymous write");
    await denied(location, { method: "PUT", uid: attackerUid, body: freshEntry() }, "other UID write");
    await denied(location, { uid: attackerUid }, "other UID unbounded individual read");
    await denied(location, {}, "anonymous individual read");
    assert.equal((await request(location, { uid: ownerUid })).status, 200);
    await denied(location, { method: "DELETE", uid: attackerUid }, "other UID delete");
    assert.equal((await request(location, { method: "DELETE", uid: ownerUid })).status, 200);
    assert.equal((await request(location, { uid: ownerUid })).body, null);
  });

  test("Emulator: exact schema rejects extras, invalid avatars, bad counters, timestamps and empty streams", async () => {
    const invalid = [
      { ...freshEntry(), email: "private@example.invalid" },
      { ...freshEntry(), protocolVersion: 2 },
      { ...freshEntry(), instanceId: "../another-user" },
      { ...freshEntry(), instanceId: "x".repeat(81) },
      { ...freshEntry(), updatedAt: "yesterday" },
      { ...freshEntry(), updatedAt: Date.now() - 60000 },
      { ...freshEntry(), updatedAt: Date.now() + 60000 },
      { ...freshEntry(), streams: {} },
      freshEntry({ twitch: { username: "creator", avatarUrl: "" } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "", secret: "not-public" } }),
      freshEntry({ tiktok: { username: "", avatarUrl: "" } }),
      freshEntry({ tiktok: { username: "@creator", avatarUrl: "" } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "http://cdn.example/avatar.webp" } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "https://user:password@cdn.example/avatar.webp" } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: `https://cdn.example/${"x".repeat(1000)}` } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "", viewers: -1 } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "", viewers: 1.5 } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "", viewers: "10" } }),
      freshEntry({ tiktok: { username: "creator", avatarUrl: "", viewers: 1000000001 } })
    ];
    for (let i = 0; i < invalid.length; i++) {
      const uid = `${prefix}-invalid-${i}`;
      await denied(`/publicLiveDirectory/${uid}`, { method: "PUT", uid, body: invalid[i] }, `invalid schema ${i}`);
    }
  });

  test("Emulator: valid TikTok and Kick streams, unknown counters and server heartbeats are accepted", async () => {
    const uid = `${prefix}-valid`;
    const location = `/publicLiveDirectory/${uid}`;
    const entry = freshEntry({
      tiktok: { username: "creator.test", avatarUrl: "" },
      kick: { username: "creator-test", avatarUrl: "https://cdn.example/kick.webp", viewers: 1000000000 }
    });
    const response = await request(location, { method: "PUT", uid, body: entry });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.updatedAt, "number");
    assert.ok(Math.abs(response.body.updatedAt - Date.now()) < 5000);
    assert.equal(response.body.streams.tiktok.viewers, undefined);
    assert.equal((await request(location, { method: "PATCH", uid, body: { updatedAt: { ".sv": "timestamp" }, "streams/tiktok/viewers": 12 } })).status, 200);
    await denied(location, { method: "PATCH", uid, body: { "streams/tiktok/privateEmail": "hidden@example.invalid" } }, "nested extra field");
    assert.equal((await request(location, { method: "DELETE", uid })).status, 200);
  });

  test("Emulator: cloud account profiles and configs remain inaccessible to public and other UID readers", async () => {
    const location = `/users/${ownerUid}`;
    const seed = await request(location, { method: "PUT", admin: true, body: { profile: { email: "owner@example.invalid" }, configs: { private: true } } });
    assert.equal(seed.status, 200);
    assert.equal((await request(location, { uid: ownerUid })).status, 200);
    await denied(location, {}, "public private account read");
    await denied(location, { uid: attackerUid }, "other UID private account read");
    await denied("/users", { uid: ownerUid }, "all users read");
    assert.equal((await request(location, { method: "DELETE", admin: true })).status, 200);
  });

  test("Emulator: conditional delete cannot remove a newer instance record", async () => {
    const location = `/publicLiveDirectory/${ownerUid}`;
    assert.equal((await request(location, { method: "PUT", uid: ownerUid, body: freshEntry() })).status, 200);
    const old = await request(location, { uid: ownerUid, headers: { "X-Firebase-ETag": "true" } });
    assert.equal(old.status, 200);
    assert.ok(old.etag);
    const replacement = { ...freshEntry(), instanceId: "22222222-2222-4222-8222-222222222222" };
    assert.equal((await request(location, { method: "PUT", uid: ownerUid, body: replacement })).status, 200);
    const staleDelete = await request(location, { method: "DELETE", uid: ownerUid, headers: { "If-Match": old.etag } });
    assert.equal(staleDelete.status, 412);
    const latest = await request(location, { uid: ownerUid, headers: { "X-Firebase-ETag": "true" } });
    assert.equal(latest.body.instanceId, replacement.instanceId);
    assert.equal((await request(location, { method: "DELETE", uid: ownerUid, headers: { "If-Match": latest.etag } })).status, 200);
  });
}
