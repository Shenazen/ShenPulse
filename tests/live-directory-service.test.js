"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { LiveDirectoryService } = require("../src/main/live-directory-service");
const { localLiveStreams, sanitizeDirectoryRows, directoryAvatarUrl } = require("../src/shared/live-directory-protocol");

async function settle() { for (let index = 0; index < 30; index += 1) await Promise.resolve(); }

function clock() {
  let current = 1000000;
  let nextId = 0;
  const tasks = new Map();
  const add = (callback, delay, repeat = 0) => {
    const handle = { id: ++nextId, unref() {} };
    tasks.set(handle.id, { handle, callback, at: current + delay, repeat });
    return handle;
  };
  return { now: () => current, timers: {
    setTimeout: (callback, delay) => add(callback, delay), clearTimeout: (handle) => tasks.delete(handle?.id),
    setInterval: (callback, delay) => add(callback, delay, delay), clearInterval: (handle) => tasks.delete(handle?.id)
  }, async advance(ms) {
    const end = current + ms;
    while (true) {
      const next = [...tasks.values()].filter((task) => task.at <= end).sort((a, b) => a.at - b.at || a.handle.id - b.handle.id)[0];
      if (!next) break;
      current = next.at;
      if (next.repeat) next.at += next.repeat; else tasks.delete(next.handle.id);
      next.callback();
      await settle();
    }
    current = end;
    await settle();
  } };
}

function state() {
  return { settings: { account: { uid: "accountA", email: "private@example.com", refreshTokenSecretId: "secret-id" },
    liveDirectory: { publishEnabled: true },
    tiktok: { username: "creator", status: "live", roomId: "private-room",
      broadcaster: { username: "creator", nickname: "Private nickname", avatarUrl: "https://cdn.example/creator.webp" }, currentViewers: 12 },
    kick: {} }, connections: [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected", config: { username: "creator" } }] };
}

function fixture(options = {}) {
  const fakeClock = clock();
  const currentState = options.state || state();
  const requests = [];
  const feeds = [];
  const database = new Map();
  let authenticated = true;
  let deleteRace = false;
  let writeHook = null;
  let identityHook = null;
  let feedDate = "";
  let failWrites = false;
  let failReads = false;
  const response = (value, extra = {}) => new Response(JSON.stringify(value), { status: 200,
    headers: { "Content-Type": "application/json", etag: '"version-one"' }, ...extra });
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    const method = init.method || "GET";
    requests.push({ url, method, init });
    if (init.headers?.Accept === "text/event-stream") {
      const feed = {};
      const body = new ReadableStream({ start(controller) {
        feed.controller = controller;
        init.signal.addEventListener("abort", () => controller.error(new Error("Aborted")), { once: true });
      } });
      feeds.push(feed);
      return new Response(body, { headers: { "Content-Type": "text/event-stream", ...(feedDate ? { Date: feedDate } : {}) } });
    }
    const uid = decodeURIComponent(url.pathname.split("/").at(-1).replace(/\.json$/, ""));
    if (method === "PUT") {
      if (failWrites) return response({ error: "Private diagnostic detail" }, { status: 503 });
      const entry = JSON.parse(init.body);
      entry.updatedAt = fakeClock.now();
      database.set(uid, entry);
      if (writeHook) await writeHook();
      return response(entry);
    }
    if (method === "DELETE") {
      if (deleteRace) return response({ error: "Race" }, { status: 412 });
      database.delete(uid);
      return response(null);
    }
    return failReads ? response({ error: "Private diagnostic detail" }, { status: 503 }) : response(database.get(uid) || null);
  };
  const service = new LiveDirectoryService({ store: { getState: () => currentState }, canPublish: () => authenticated,
    identityProvider: async () => identityHook ? identityHook() : { uid: currentState.settings.account.uid, idToken: "private-token" },
    fetchImpl, now: fakeClock.now, timers: fakeClock.timers, instanceId: "our-instance" });
  return { service, state: currentState, requests, feeds, database, clock: fakeClock,
    setAuthenticated: (value) => { authenticated = value; }, setDeleteRace: () => { deleteRace = true; },
    setWriteHook: (value) => { writeHook = value; }, setIdentityHook: (value) => { identityHook = value; },
    setFeedDate: (value) => { feedDate = value; }, setFailWrites: () => { failWrites = true; }, setFailReads: () => { failReads = true; },
    async start() { service.start(); await fakeClock.advance(0); },
    async feed(event, data, path = "/") {
      feeds.at(-1).controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify({ path, data })}\n\n`));
      await settle();
    }, writes: () => requests.filter((request) => request.method === "PUT"),
    deletes: () => requests.filter((request) => request.method === "DELETE") };
}

function entry(now, { username = "creator", viewers = 7, instanceId = "other-instance", ...extra } = {}) {
  return { protocolVersion: 1, instanceId, updatedAt: now,
    streams: { tiktok: { username, avatarUrl: "https://cdn.example/avatar.webp", viewers } }, ...extra };
}

test("directory feed is bounded, public, and never carries account credentials", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  const request = fx.requests[0];
  assert.equal(request.url.pathname, "/publicLiveDirectory.json");
  assert.equal(request.url.searchParams.get("orderBy"), '"updatedAt"');
  assert.equal(request.url.searchParams.get("limitToLast"), "100");
  assert.equal(request.url.searchParams.get("startAt"), "910000");
  assert.equal(request.url.searchParams.has("auth"), false);
  assert.equal(fx.writes().length, 0);
  await fx.service.stop();
});

test("publication contains exactly public LIVE metadata and a server timestamp", async () => {
  const fx = fixture();
  fx.state.settings.tiktok.currentViewers = 0;
  await fx.start();
  const request = fx.writes()[0];
  assert.equal(request.url.pathname, "/publicLiveDirectory/accountA.json");
  assert.deepEqual(JSON.parse(request.init.body), { protocolVersion: 1, instanceId: "our-instance",
    updatedAt: { ".sv": "timestamp" }, streams: { tiktok: { username: "creator", avatarUrl: "https://cdn.example/creator.webp", viewers: 0 } } });
  assert.equal(fx.service.status().publishing, true);
  assert.doesNotMatch(request.init.body, /private|secret|email|roomId|nickname/);
  assert.equal(JSON.stringify(fx.service.status()).includes("private-token"), false);
  await fx.service.stop();
});

test("manual session, disabled/chat-only source and wrong TikTok owner are not LIVE proof", () => {
  const current = state();
  current.session = { running: true };
  current.settings.tiktok.status = "connected";
  assert.deepEqual(localLiveStreams(current), {});
  current.settings.tiktok.status = "live";
  current.connections[0].enabled = false;
  assert.deepEqual(localLiveStreams(current), {});
  current.connections[0].enabled = true;
  current.settings.tiktok.broadcaster.username = "another.creator";
  assert.deepEqual(localLiveStreams(current), {});
  current.settings.tiktok.broadcaster.username = "creator";
  current.connections[0].liveStatus = "offline";
  assert.deepEqual(localLiveStreams(current), {});
});

test("Kick publishes verified live state without treating its fallback zero as measured", () => {
  const current = state();
  current.settings.tiktok.status = "offline";
  current.settings.kick = { live: true, viewers: 0, account: { name: "kick-creator", avatarUrl: "https://cdn.example/kick.webp" } };
  current.connections.push({ id: "source_kick", type: "kick-native", enabled: true, status: "connected" });
  assert.deepEqual(localLiveStreams(current), { kick: { username: "kick-creator", avatarUrl: "https://cdn.example/kick.webp" } });
  current.settings.kick.viewers = 19;
  assert.equal(localLiveStreams(current).kick.viewers, 19);
  current.settings.kick.live = false;
  assert.deepEqual(localLiveStreams(current), {});
});

test("untrusted feed values are sanitized and stale, far-future and duplicate creators excluded", () => {
  const now = 1000000;
  const entries = { valid: entry(now, { viewers: 0 }), duplicate: entry(now - 1),
    stale: entry(now - 90001, { username: "old" }), future: entry(now + 30001, { username: "future" }),
    invalid: entry(now, { username: '<img src="x">' }),
    unsafe: entry(now, { username: "unsafe", viewers: -1, streams: { tiktok: { username: "unsafe", avatarUrl: "javascript:alert(1)", viewers: -1 } } }) };
  const rows = sanitizeDirectoryRows(entries, { now, ownUid: "valid" });
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.username === "creator").viewers, 0);
  assert.equal(rows.find((row) => row.username === "creator").own, true);
  assert.equal(rows.find((row) => row.username === "unsafe").avatarUrl, "");
  assert.equal(rows.find((row) => row.username === "unsafe").viewers, null);
  assert.equal(directoryAvatarUrl("https://user:password@cdn.example/a"), "");
  assert.equal(directoryAvatarUrl("https://127.0.0.1/a"), "");
  assert.equal(directoryAvatarUrl("http://cdn.example/a"), "");
});

test("SSE put, nested patch and removal update public rows, with own-account identification", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  await fx.feed("put", { accountA: entry(fx.clock.now()), accountB: entry(fx.clock.now(), { username: "second" }) });
  assert.equal(fx.service.status().available, true);
  assert.equal(fx.service.status().rows.length, 2);
  assert.equal(fx.service.status().rows.find((row) => row.username === "creator").own, true);
  await fx.feed("patch", { viewers: 35 }, "/accountB/streams/tiktok");
  assert.equal(fx.service.status().rows[0].viewers, 35);
  await fx.feed("put", null, "/accountA");
  assert.equal(fx.service.status().rows.length, 1);
  await fx.service.stop();
});

test("local TTL pruning removes a crashed creator even if Firebase sends no event", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  await fx.feed("put", { accountB: entry(fx.clock.now()) });
  let lastStatus;
  fx.service.on("changed", (value) => { lastStatus = value; });
  await fx.clock.advance(95000);
  assert.equal(fx.service.status().rows.length, 0);
  assert.equal(lastStatus.rows.length, 0);
  await fx.service.stop();
});

test("viewer storms coalesce to at most one publication per ten seconds", async () => {
  const fx = fixture();
  await fx.start();
  for (let viewers = 0; viewers <= 99; viewers += 1) {
    fx.state.settings.tiktok.currentViewers = viewers;
    fx.service.sync();
  }
  await fx.clock.advance(9999);
  assert.equal(fx.writes().length, 1);
  await fx.clock.advance(1);
  assert.equal(fx.writes().length, 2);
  assert.equal(JSON.parse(fx.writes()[1].init.body).streams.tiktok.viewers, 99);
  await fx.service.stop();
});

test("unchanged LIVE metadata renews its server timestamp on the thirty-second heartbeat", async () => {
  const fx = fixture();
  await fx.start();
  await fx.clock.advance(30000);
  assert.equal(fx.writes().length, 2);
  assert.equal(fx.database.get("accountA").updatedAt, fx.clock.now());
  await fx.service.stop();
});

test("privacy opt-out bypasses publication throttle and removes only this instance with ETag", async () => {
  const fx = fixture();
  await fx.start();
  fx.state.settings.liveDirectory.publishEnabled = false;
  fx.service.sync();
  await fx.clock.advance(0);
  assert.equal(fx.database.has("accountA"), false);
  assert.equal(fx.deletes().length, 1);
  assert.equal(fx.deletes()[0].init.headers["If-Match"], '"version-one"');
  assert.equal(fx.service.status().publishing, false);
  await fx.service.stop();
});

test("ending the actual LIVE removes presence even while manual session keeps running", async () => {
  const fx = fixture();
  await fx.start();
  fx.state.settings.tiktok.status = "waiting";
  fx.state.session = { running: true };
  fx.service.sync();
  await fx.clock.advance(0);
  assert.equal(fx.database.has("accountA"), false);
  assert.equal(fx.service.status().rows.length, 0);
  await fx.service.stop();
});

test("suspension is sticky until explicit resume and cleans presence before account logout", async () => {
  const fx = fixture();
  await fx.start();
  await fx.service.suspendPublication();
  fx.service.sync();
  await fx.clock.advance(30000);
  assert.equal(fx.writes().length, 1);
  assert.equal(fx.database.has("accountA"), false);
  fx.service.resumePublication();
  await fx.clock.advance(0);
  assert.equal(fx.writes().length, 2);
  await fx.service.stop();
});

test("late identity resolution cannot publish after privacy was revoked", async () => {
  const fx = fixture();
  let resolveIdentity;
  fx.setIdentityHook(() => new Promise((resolve) => { resolveIdentity = resolve; }));
  await fx.start();
  const suspended = fx.service.suspendPublication();
  fx.state.settings.liveDirectory.publishEnabled = false;
  resolveIdentity({ uid: "accountA", idToken: "private-token" });
  await suspended;
  assert.equal(fx.writes().length, 0);
  await fx.service.stop();
});

test("opt-out during an in-flight accepted PUT serializes removal after its completion", async () => {
  const fx = fixture();
  let finishWrite;
  fx.setWriteHook(() => new Promise((resolve) => { finishWrite = resolve; }));
  await fx.start();
  const suspended = fx.service.suspendPublication();
  fx.state.settings.liveDirectory.publishEnabled = false;
  finishWrite();
  await suspended;
  assert.equal(fx.database.has("accountA"), false);
  assert.equal(fx.deletes().length, 1);
  await fx.service.stop();
});

test("shutdown never deletes a newer computer instance of the same account", async () => {
  const fx = fixture();
  await fx.start();
  fx.database.set("accountA", entry(fx.clock.now(), { instanceId: "new-computer" }));
  await fx.service.stop();
  assert.equal(fx.deletes().length, 0);
  assert.equal(fx.database.get("accountA").instanceId, "new-computer");
});

test("conditional-deletion conflict preserves a newer remote heartbeat", async () => {
  const fx = fixture();
  await fx.start();
  fx.setDeleteRace();
  await fx.service.suspendPublication();
  assert.equal(fx.database.has("accountA"), true);
  assert.equal(fx.service.status().publishing, false);
  await fx.service.stop();
});

test("account switch cleans the old identity without publishing another account's stale sources", async () => {
  const fx = fixture();
  await fx.start();
  await fx.service.suspendPublication();
  fx.state.settings.account.uid = "accountB";
  fx.state.settings.tiktok.status = "offline";
  fx.service.resumePublication();
  await fx.clock.advance(0);
  assert.equal(fx.database.has("accountA"), false);
  assert.equal(fx.database.has("accountB"), false);
  await fx.service.stop();
});

test("guest authentication state cannot publish an opted-in local source", async () => {
  const fx = fixture();
  fx.setAuthenticated(false);
  await fx.start();
  assert.equal(fx.writes().length, 0);
  await fx.service.stop();
});

test("permission cancellation retains TTL safety and reconnects a fresh bounded query", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  fx.feeds[0].controller.enqueue(new TextEncoder().encode('event: cancel\ndata: "Permission denied"\n\n'));
  await settle();
  assert.equal(fx.service.status().connected, false);
  assert.match(fx.service.status().error, /temporairement/);
  await fx.clock.advance(1000);
  assert.equal(fx.feeds.length, 2);
  assert.equal(fx.requests.at(-1).url.searchParams.get("startAt"), "911000");
  await fx.service.stop();
});

test("malformed and oversized directory events never expose raw network errors", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  fx.feeds[0].controller.enqueue(new TextEncoder().encode('event: put\ndata: private-token-is-not-json\n\n'));
  await settle();
  assert.equal(fx.service.status().connected, false);
  assert.equal(JSON.stringify(fx.service.status()).includes("private-token"), false);
  await fx.service.stop();
});

test("failed writes and cleanup retries remain throttled during repeated local runtime updates", async () => {
  const fx = fixture();
  fx.setFailWrites();
  await fx.start();
  for (let update = 0; update < 100; update += 1) fx.service.sync();
  await fx.clock.advance(9999);
  assert.equal(fx.writes().length, 1);
  await fx.clock.advance(1);
  assert.equal(fx.writes().length, 2);
  assert.equal(fx.service.status().error.includes("Private diagnostic"), false);
  fx.state.settings.liveDirectory.publishEnabled = false;
  fx.setFailReads();
  fx.service.sync();
  await fx.clock.advance(0);
  const reads = fx.requests.filter((request) => request.init.headers?.["X-Firebase-ETag"] === "true").length;
  for (let update = 0; update < 50; update += 1) { fx.service.sync(); await fx.clock.advance(0); }
  assert.equal(fx.requests.filter((request) => request.init.headers?.["X-Firebase-ETag"] === "true").length, reads);
  await fx.service.stop();
});

test("HTTP Date corrects a skewed guest clock and rebuilds its bounded public query", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  fx.setFeedDate(new Date(fx.clock.now() + 600000).toUTCString());
  await fx.start();
  assert.equal(fx.service.status().connected, false);
  await fx.clock.advance(1000);
  assert.equal(fx.feeds.length, 2);
  assert.equal(fx.requests.at(-1).url.searchParams.get("startAt"), "1511000");
  await fx.feed("put", { accountB: entry(1600000) });
  assert.equal(fx.service.status().rows.length, 1);
  await fx.service.stop();
});

test("capacity indicator expires along with stale entries instead of remaining 100 plus forever", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  const data = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`user${index}`, entry(fx.clock.now(), { username: `creator${index}` })]));
  await fx.feed("put", data);
  assert.equal(fx.service.status().capped, true);
  await fx.clock.advance(95000);
  assert.equal(fx.service.status().capped, false);
  await fx.service.stop();
});

test("SSE frames split across CRLF and UTF-8 boundaries remain parseable", async () => {
  const fx = fixture();
  fx.state.settings.liveDirectory.publishEnabled = false;
  await fx.start();
  const frame = `event: put\r\ndata: ${JSON.stringify({ path: "/", data: { accountB: entry(fx.clock.now()) } })}\r\n\r\n`;
  const bytes = new TextEncoder().encode(frame);
  for (const byte of bytes) fx.feeds[0].controller.enqueue(Uint8Array.of(byte));
  await settle();
  await settle();
  await settle();
  // Each reader continuation consumes one chunk; drain the intentionally fragmented stream.
  for (let round = 0; round < 20; round += 1) await settle();
  assert.equal(fx.service.status().rows.length, 1);
  await fx.service.stop();
});

test("a stalled account-token refresh cannot hold publication or logout indefinitely", async () => {
  const fx = fixture();
  fx.setIdentityHook(() => new Promise(() => {}));
  await fx.start();
  const suspended = fx.service.suspendPublication();
  await fx.clock.advance(8000);
  await suspended;
  assert.equal(fx.writes().length, 0);
  assert.equal(fx.service.status().publishing, false);
  assert.equal(fx.service.status().error.includes("token"), false);
  await fx.service.stop();
});

test("failed heartbeat publication no longer claims an expired public presence", async () => {
  const fx = fixture();
  await fx.start();
  fx.setFailWrites();
  await fx.clock.advance(95000);
  assert.equal(fx.service.status().publishing, false);
  await fx.service.stop();
});

test("lightweight store snapshot avoids cloning unrelated account workspaces", async () => {
  const current = state();
  let reads = 0;
  const service = new LiveDirectoryService({
    store: { getLiveDirectoryState() { reads += 1; return current; }, getState() { throw new Error("Full state must not be cloned"); } },
    canPublish: () => false
  });
  assert.equal(service.status().enabled, true);
  assert.equal(service.status().rows.length, 0);
  assert.equal(service.sync().publishing, false);
  assert.ok(reads > 0);
  await service.stop();
});
