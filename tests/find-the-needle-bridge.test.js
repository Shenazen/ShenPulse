"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { FindTheNeedleBridge, buildFindTheNeedleAction, findTheNeedleEndpoint } = require("../src/main/find-the-needle-bridge");
const { FIND_THE_NEEDLE_COMMAND_SPECS } = require("../src/main/find-the-needle-catalog");
const { GameHub } = require("../src/main/game-hub");
const { createDefaultState } = require("../src/main/defaults");

function health(game = {}) {
  return { ok: true, mod: "s2e-find-the-needle", version: "1.2.7", port: 55001,
    game: { ready: true, compatible: true, focused: true, paused: false, scene: "yard", ...game } };
}
function confirmation(command = "givemoney", extra = {}) {
  return { ok: true, command, version: "1.2.7", paused: false, waitingForFocus: false, ...extra };
}
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function action(code = "givemoney", parameters = {}) {
  return { requestId: "fixture-effect-1", effect: { code, viewer: "Spectateur", parameters, quantity: 500 } };
}

test("les 37 commandes attestées par le mod ont une charge utile strictement bornée", () => {
  const codes = ["givemoney", "takemoney", "setmoney", "tornado", "hayrain", "scatterhay", "sellhay", "haymagnet", "sellloosehay",
    "unlocktech", "locktech", "randomupgrade", "randomdowngrade", "lockshop", "unlockshop", "stopmachines", "startmachines", "freeze",
    "slowmotion", "fastforward", "stamina", "rush", "dropheld", "unlockbuilding", "lockbuilding", "spawnbuilding", "priceup", "pricedown",
    "spillhay", "fling", "respawn", "fisheye", "tunnelvision", "blackout", "disco", "fog", "reset"];
  assert.deepEqual(Object.keys(FIND_THE_NEEDLE_COMMAND_SPECS).sort(), codes.sort());
  for (const code of codes) {
    const spec = FIND_THE_NEEDLE_COMMAND_SPECS[code];
    const built = buildFindTheNeedleAction(action(code));
    assert.equal(built.command, code);
    assert.equal(built.body.name, "Spectateur");
    assert.equal(built.body.requestId, "fixture-effect-1");
    assert.equal(built.body.quantity, undefined, "la quantité générique ne crée pas une rafale de requêtes");
    if (spec.kind === "number" || spec.kind === "duration") {
      assert.equal(built.body.effect, spec.defaultValue);
      assert.equal(buildFindTheNeedleAction(action(code, { effect: -1e20 })).body.effect, spec.min);
      assert.equal(buildFindTheNeedleAction(action(code, { effect: 1e20 })).body.effect, spec.max);
      for (const invalid of [Infinity, NaN, "non", true, {}, []]) {
        assert.throws(() => buildFindTheNeedleAction(action(code, { effect: invalid })), { code: "NEEDLE_PARAMETER_INVALID" });
      }
    } else if (spec.kind === "target") {
      assert.equal(built.body.effect, "random");
    } else {
      assert.deepEqual(Object.keys(built.body).sort(), ["name", "requestId"]);
    }
  }
});

test("durées, pourcentages, rangs et identifiants ne sont pas confondus", () => {
  assert.deepEqual(buildFindTheNeedleAction(action("tornado", { effect: 6, duration: 12 })).body,
    { name: "Spectateur", requestId: "fixture-effect-1", effect: 12, duration: 12 });
  assert.equal(buildFindTheNeedleAction(action("freeze", { effect: 8 })).body.duration, 8);
  assert.equal(buildFindTheNeedleAction(action("priceup", { effect: 35, duration: 40 })).body.duration, 40);
  assert.equal(buildFindTheNeedleAction(action("priceup", { effect: 35 })).body.duration, 30);
  assert.equal(buildFindTheNeedleAction(action("pricedown", { effect: 35, duration: 1e10 })).body.duration, 300);
  assert.equal(buildFindTheNeedleAction(action("hayrain", { effect: 55.9 })).body.effect, 55);
  assert.equal(buildFindTheNeedleAction(action("givemoney", { effect: 0.99 })).body.effect, 0.99);
  assert.equal(buildFindTheNeedleAction(action("unlocktech", { effect: "wheelbarrow", rank: 1e10 })).body.rank, 100);
  assert.equal(buildFindTheNeedleAction(action("locktech", { effect: "bucket" })).body.rank, 1);
  assert.equal(buildFindTheNeedleAction(action("spawnbuilding", { effect: "selling_belt-2" })).body.effect, "selling_belt-2");
  for (const invalid of ["../health", "random\r\nInjected", "a/b", "x?effect=0", "a".repeat(81), ""]) {
    assert.throws(() => buildFindTheNeedleAction(action("unlockbuilding", { effect: invalid })), { code: "NEEDLE_PARAMETER_INVALID" });
  }
});

test("aucun endpoint ou hôte libre ne peut être transmis au mod", () => {
  assert.equal(findTheNeedleEndpoint({}, "health").href, "http://127.0.0.1:55001/health");
  assert.equal(findTheNeedleEndpoint({ url: "http://localhost:55002" }, "reset").href, "http://127.0.0.1:55002/reset");
  for (const url of ["https://127.0.0.1:55001", "http://example.test:55001", "http://127.0.0.1.evil.test:55001",
    "http://192.168.1.1:55001", "http://127.0.0.2:55001", "http://[::1]:55001", "http://127.0.0.1:80",
    "http://name:password@127.0.0.1:55001", "http://127.0.0.1:55001/commands", "http://127.0.0.1:55001/?x=1",
    "http://127.0.0.1:55001/#x", "file:///tmp/a", "invalide"]) {
    assert.throws(() => findTheNeedleEndpoint({ url }, "health"), { code: "NEEDLE_PROTOCOL_MISMATCH" });
  }
  for (const code of ["constructor", "__proto__", "health", "../givemoney", "givemoney?effect=100", "addmoney", "givemoney/", "GIVEMONEY"]) {
    assert.throws(() => buildFindTheNeedleAction(action(code)), { code: "NEEDLE_PROTOCOL_MISMATCH" });
  }
});

test("le nom et l’identifiant sont nettoyés sans introduire de champs arbitraires", () => {
  const payload = action("givemoney", { effect: 12, url: "http://example.test", command: "reset", arbitrary: true });
  payload.requestId = "\0" + "x".repeat(120);
  const built = buildFindTheNeedleAction(payload, { user: { displayName: "A\n\r\0" + "b".repeat(100) } });
  assert.equal(built.body.name.length, 64);
  assert.equal(built.body.requestId.length, 96);
  assert.doesNotMatch(built.body.name + built.body.requestId, /[\u0000-\u001f]/);
  assert.deepEqual(Object.keys(built.body).sort(), ["effect", "name", "requestId"]);
});

test("le diagnostic identifie le mod et distingue une partie absente d’un mod absent", async () => {
  const requests = [];
  let game = {};
  const bridge = new FindTheNeedleBridge({ fetchImpl: async (url, options) => {
    requests.push([String(url), options]); return jsonResponse(health(game));
  } });
  assert.equal((await bridge.status()).ok, true);
  game = { ready: false, scene: "menu" };
  const menu = await bridge.status();
  assert.equal(menu.ok, false); assert.equal(menu.connected, true); assert.match(menu.message, /partie/);
  game = { compatible: false };
  assert.equal((await bridge.status()).ok, false);
  game = { paused: true };
  assert.match((await bridge.status()).message, /pause/);
  game = { focused: false };
  assert.match((await bridge.status()).message, /premier plan/);
  assert.ok(requests.every(([url, options]) => url.endsWith("/health") && options.method === "GET" && options.redirect === "manual"));
});

test("une POST réelle au serveur HTTP de test conserve l’identité, les paramètres et le jeton en mémoire", async (context) => {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, path: request.url, headers: request.headers,
      body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(request.method === "GET" ? health() : confirmation("priceup")));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const connector = { url: `http://127.0.0.1:${server.address().port}`, secretId: "fixture-secret" };
  const bridge = new FindTheNeedleBridge({ getToken: (value) => { assert.equal(value.secretId, "fixture-secret"); return "fixture-only-mod-token"; } });
  let guards = 0;
  const result = await bridge.trigger(connector, action("priceup", { effect: 25, duration: 12 }), {
    user: { displayName: "Nova" }, assertGameAccess() { guards += 1; }
  });
  assert.equal(result.status, "success"); assert.equal(result.count, 1); assert.equal(guards, 3);
  assert.deepEqual(requests.map((request) => request.method + " " + request.path), ["GET /health", "POST /priceup"]);
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[1].headers.authorization, "Bearer fixture-only-mod-token");
  assert.equal(requests[1].headers["content-type"], "application/json");
  assert.deepEqual(requests[1].body, { name: "Nova", requestId: "fixture-effect-1", effect: 25, duration: 12 });
  assert.doesNotMatch(JSON.stringify(result), /fixture-only-mod-token/);
});

test("aucune action n’est envoyée à un autre service ou une version non vérifiée", async () => {
  for (const state of [null, [], {}, { ...health(), mod: "autre" }, { ...health(), version: "2.0.0" },
    { ...health(), game: {} }, { ...health(), game: { ready: "true", compatible: true } }]) {
    const methods = [];
    const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) => { methods.push(options.method); return jsonResponse(state); } });
    await assert.rejects(bridge.trigger({}, action()), { code: "NEEDLE_PROTOCOL_MISMATCH" });
    assert.deepEqual(methods, ["GET"]);
  }
  for (const game of [{ ready: false }, { compatible: false }]) {
    const methods = [];
    const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) => { methods.push(options.method); return jsonResponse(health(game)); } });
    await assert.rejects(bridge.trigger({}, action()), /partie|incompatible/);
    assert.deepEqual(methods, ["GET"]);
  }
});

test("les refus du mod ne deviennent jamais des succès et ne sont jamais rejoués", async () => {
  for (const [status, errorCode, message] of [[409, "game_not_ready", /partie/], [403, "unauthorized", /jeton/],
    [422, "nothing_to_drop", /aucun objet/], [429, "cooldown", /effet important/], [422, "effect_queue_full", /pleine/]]) {
    let count = 0;
    const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) => {
      count += 1;
      return options.method === "GET" ? jsonResponse(health()) : jsonResponse({ ok: false, error: errorCode, retryAfterMs: 350 }, status);
    } });
    await assert.rejects(bridge.trigger({}, action()), (error) => {
      assert.equal(error.code, "NEEDLE_EFFECT_REJECTED"); assert.match(error.message, message);
      if (status === 429) assert.equal(error.retryAfterMs, 350);
      return true;
    });
    assert.equal(count, 2);
  }
  for (const result of [{ ok: false, error: "unknown", message: "<script>secret</script>" },
    confirmation("takemoney"), confirmation("givemoney", { version: "1.2.8" }), { accepted: true }]) {
    const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) =>
      jsonResponse(options.method === "GET" ? health() : result) });
    await assert.rejects(bridge.trigger({}, action()), (error) => {
      assert.doesNotMatch(error.message, /script|secret/); return true;
    });
  }
});

test("les réponses redirigées, HTML ou volumineuses sont rejetées avant toute action", async () => {
  for (const response of [() => new Response("", { status: 302, headers: { Location: "https://example.test" } }),
    () => new Response("<html>not the mod</html>"),
    () => new Response("{}", { headers: { "Content-Length": "65537" } }),
    () => new Response(" ".repeat(65537))]) {
    let count = 0;
    const bridge = new FindTheNeedleBridge({ fetchImpl: async () => { count += 1; return response(); } });
    await assert.rejects(bridge.trigger({}, action()), { code: "NEEDLE_PROTOCOL_MISMATCH" });
    assert.equal(count, 1);
  }
});

test("le timeout englobe la requête et le corps sans révéler l’URL ou le jeton", async () => {
  const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("fake secret"), { name: "AbortError" })), { once: true });
  }) });
  await assert.rejects(bridge.status({ timeoutMs: 100 }), { code: "NEEDLE_TIMEOUT" });
  const offline = new FindTheNeedleBridge({ fetchImpl: async () => { throw new Error("fixture private network details"); } });
  await assert.rejects(offline.status(), (error) => {
    assert.equal(error.code, "NEEDLE_CONNECTION_FAILED"); assert.doesNotMatch(error.message, /private|details/); return true;
  });
});

test("les effets reçus en pause ou hors focus signalent honnêtement leur attente", async () => {
  for (const [flag, message] of [["waitingForFocus", /premier plan/], ["paused", /Reprenez/]]) {
    const bridge = new FindTheNeedleBridge({ fetchImpl: async (_url, options) =>
      jsonResponse(options.method === "GET" ? health() : confirmation("givemoney", { [flag]: true })) });
    assert.match((await bridge.trigger({}, action())).message, message);
  }
});

function hubFixture(fetchImpl) {
  const state = createDefaultState();
  state.settings.account = { uid: "fixture-owner", email: "alexandre.leuridan@gmail.com", emailVerified: true, refreshTokenSecretId: "fixture-account" };
  state.commerce.subscription = { tier: "pro", status: "active" };
  state.session.profileId = "fixture-profile";
  const store = { getState: () => structuredClone(state), getSecret: () => "fixture-only-token" };
  const hub = new GameHub({ store, packsDirectory: "fixture-unused", findTheNeedleBridge: new FindTheNeedleBridge({ fetchImpl }) });
  hub.packs = [{ id: "fixture-needle", name: "Démo", ownerOnly: true, accessMode: "included",
    connector: { type: "find-the-needle-http" }, effects: [{ id: "effect", code: "givemoney", available: true }] }];
  return { state, hub };
}

test("le compte propriétaire et Pro sont contrôlés avant le moindre accès HTTP", async () => {
  for (const mutate of [(state) => { state.settings.account.email = "autre@example.test"; },
    (state) => { state.settings.account.emailVerified = false; },
    (state) => { state.commerce.subscription = { tier: "free", status: "free" }; },
    (state) => { state.settings.account.refreshTokenSecretId = ""; }]) {
    let requests = 0;
    const { state, hub } = hubFixture(async () => { requests += 1; return jsonResponse(health()); });
    mutate(state);
    await assert.rejects(hub.trigger("effect", {}, { packId: "fixture-needle" }));
    await assert.rejects(hub.testConnection("fixture-needle"));
    assert.equal(requests, 0);
  }
});

test("un changement de profil, compte, abonnement ou LIVE pendant le GET annule la POST", async () => {
  for (const mutate of [(state) => { state.session.profileId = "autre-profil"; },
    (state) => { state.settings.account.uid = "autre-compte"; },
    (state) => { state.commerce.subscription = { tier: "free", status: "free" }; },
    (_state, live) => { live.active = false; }]) {
    const methods = [];
    const live = { active: true };
    const fixture = hubFixture(async (_url, options) => {
      methods.push(options.method); mutate(fixture.state, live); return jsonResponse(health());
    });
    await assert.rejects(fixture.hub.trigger("effect", { shouldExecute: () => live.active }, { packId: "fixture-needle" }),
      (error) => ["FEATURE_CONTEXT_CHANGED", "PRO_FEATURE_REQUIRED", "COMMAND_CONTEXT_CHANGED"].includes(error.code));
    assert.deepEqual(methods, ["GET"]);
  }
});
