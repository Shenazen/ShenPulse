"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const {
  OverlayServer,
  hasProOverlayAccess,
  normalizeMatchPlaybackRequest,
  overlayViewAcceptsChannel,
  overlayViewRequiresPro
} = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test("protège l'état local et accepte un événement authentifié", async () => {
  const overlayPort = await freePort();
  const apiPort = await freePort();
  const state = {
    settings: {
      overlayPort,
      apiPort,
      overlayToken: "overlay-secret",
      apiToken: "api-secret",
      account: { uid: "account-test-1" },
      matchAccess: { accessKey: "a".repeat(32) },
      publicOverlayRelay: {
        publicBaseUrl: "https://shenpulse-overlays.web.app",
        matchChannelId: "m".repeat(24)
      }
    },
    goals: [],
    session: { running: false },
    statistics: {},
    commerce: {
      subscription: {
        tier: "free",
        source: "free",
        status: "free"
      }
    }
  };
  const inbound = [];
  const server = new OverlayServer({
    store: { getState: () => structuredClone(state) },
    staticDirectory: path.join(__dirname, "..", "resources", "overlays"),
    onInboundEvent: async (event) => inbound.push(event),
    onEffectRequest: async () => ({ ok: true })
  });

  try {
    await server.start();
    const urls = server.urls();
    assert.equal(urls.mediaScreens.length, 8);
    assert.equal(new Set(urls.mediaScreens).size, 8);
    assert.equal(new URL(urls.mediaScreens[0]).searchParams.get("screen"), "1");
    assert.equal(new URL(urls.mediaScreens[7]).searchParams.get("screen"), "8");
    assert.match(urls.likeGoal, /view=like-goal/);
    assert.match(urls.coinJar, /view=coin-jar/);
    assert.match(urls.topDonors, /kind=donors/);
    assert.equal(urls.matchEnigma, "");
    assert.equal(urls.matchPlayer, "");
    assert.equal(urls.winCounter, "");
    assert.equal(urls.multiplierTimer, "");
    const health = await fetch(`http://127.0.0.1:${overlayPort}/health`);
    assert.equal(health.status, 200);

    const deniedDocument = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/?view=like-goal`
    );
    assert.equal(deniedDocument.status, 401);
    const freeDocument = await fetch(urls.likeGoal);
    assert.equal(freeDocument.status, 200);
    assert.equal(freeDocument.headers.get("cache-control"), "no-store");
    const liveStylesheet = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/overlay.css`
    );
    assert.equal(liveStylesheet.status, 200);
    assert.equal(liveStylesheet.headers.get("cache-control"), "private, no-cache");
    assert.ok(liveStylesheet.headers.get("etag"));
    const liveScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/overlay.js`
    );
    assert.equal(liveScript.status, 200);
    assert.equal(liveScript.headers.get("cache-control"), "private, no-cache");
    const cachedLiveScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/overlay.js`,
      { headers: { "If-None-Match": liveScript.headers.get("etag") } }
    );
    assert.equal(cachedLiveScript.status, 304);
    const runtimeScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/runtime/configuration.js`
    );
    assert.equal(runtimeScript.status, 200);
    assert.match(runtimeScript.headers.get("content-type"), /javascript/);
    const manifestScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/catalog/like-goal.js`
    );
    assert.equal(manifestScript.status, 200);
    assert.match(manifestScript.headers.get("content-type"), /javascript/);
    const importedStylesheet = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/styles/core.css`
    );
    assert.equal(importedStylesheet.status, 200);
    assert.match(importedStylesheet.headers.get("content-type"), /css/);
    const vendorScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/vendor/lottie-player.js`
    );
    assert.equal(vendorScript.status, 200);
    assert.match(vendorScript.headers.get("content-type"), /javascript/);
    const lottieAnimation = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/media/lottie/10849-halloween-pumpkin.json?token=overlay-secret`
    );
    assert.equal(lottieAnimation.status, 200);
    assert.match(lottieAnimation.headers.get("content-type"), /application\/json/);
    assert.equal(typeof (await lottieAnimation.json()).layers, "object");
    const proDocumentWhileFree = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/?view=win-counter&token=overlay-secret`
    );
    assert.equal(proDocumentWhileFree.status, 403);
    const proStaticPreviewWhileFree = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/?view=win-counter&preview=static&token=overlay-secret`
    );
    assert.equal(proStaticPreviewWhileFree.status, 200);
    const proAnimatedPreviewWhileFree = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/?view=match&preview=animated&token=overlay-secret`
    );
    assert.equal(proAnimatedPreviewWhileFree.status, 200);
    const matchVideoWhileFree = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/media/video/x2-tikcontrol.webm?token=overlay-secret`
    );
    assert.equal(matchVideoWhileFree.status, 403);
    assert.throws(
      () => server.playMatch({ match: "x2" }),
      /abonnement Pro actif/
    );
    const proEventsWhileFree = await fetch(
      `http://127.0.0.1:${overlayPort}/events?view=win-counter&preview=static&token=overlay-secret`
    );
    assert.equal(proEventsWhileFree.status, 403);

    const denied = await fetch(`http://127.0.0.1:${overlayPort}/api/state`);
    assert.equal(denied.status, 401);

    const allowed = await fetch(
      `http://127.0.0.1:${overlayPort}/api/state?token=overlay-secret`
    );
    assert.equal(allowed.status, 200);

    const accepted = await fetch(
      `http://127.0.0.1:${apiPort}/api/events?token=api-secret`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "gift", data: { giftName: "Rose" } })
      }
    );
    assert.equal(accepted.status, 202);
    assert.equal(inbound.length, 1);

    state.commerce.subscription = {
      tier: "pro",
      source: "paid",
      status: "active"
    };
    const proUrls = server.urls();
    assert.match(proUrls.matchEnigma, /match=enigma/);
    assert.match(proUrls.matchPlayer, /\/match\/\d{12}\/a{32}$/);
    assert.match(proUrls.winCounter, /view=win-counter/);
    const proDocument = await fetch(proUrls.winCounter);
    assert.equal(proDocument.status, 200);
    const protectedMatchVideo = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/media/video/x2-tikcontrol.webm?token=overlay-secret`
    );
    assert.equal(protectedMatchVideo.status, 200);
    assert.equal(protectedMatchVideo.headers.get("cache-control"), "no-store");
    await protectedMatchVideo.body.cancel();
    const matchDocument = await fetch(proUrls.matchPlayer);
    assert.equal(matchDocument.status, 200);
    assert.match(await matchDocument.text(), /<base href="\/overlay\/"/);
    const invalidMatchDocument = await fetch(
      proUrls.matchPlayer.replace(/\/match\/\d{12}\//, "/match/000000000000/")
    );
    assert.equal(invalidMatchDocument.status, 401);
    const ticketResponse = await fetch(
      `${proUrls.matchPlayer}/ticket?match=x2&variant=tikcontrol&fit=contain`
    );
    assert.equal(ticketResponse.status, 200);
    const ticket = await ticketResponse.json();
    assert.match(ticket.url, /^\/match-media\/[A-Za-z0-9_-]{32}$/);
    assert.doesNotMatch(ticket.url, /x2|tikcontrol|\.webm/);
    const ticketMedia = await fetch(
      `http://127.0.0.1:${overlayPort}${ticket.url}`,
      { headers: { Range: "bytes=0-127" } }
    );
    assert.equal(ticketMedia.status, 206);
    assert.equal(ticketMedia.headers.get("content-length"), "128");
    assert.match(ticketMedia.headers.get("content-range"), /^bytes 0-127\//);
    assert.equal(ticketMedia.headers.get("cache-control"), "no-store");
    await ticketMedia.body.cancel();

    const matchBridge = `http://127.0.0.1:${overlayPort}/match-bridge/${
      matchAccountNumber(state.settings.account.uid)
    }/${state.settings.publicOverlayRelay.matchChannelId}/ticket`;
    const bridgePreflight = await fetch(matchBridge, {
      method: "OPTIONS",
      headers: {
        Origin: "https://shenpulse-overlays.web.app",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Private-Network": "true"
      }
    });
    assert.equal(bridgePreflight.status, 204);
    assert.equal(
      bridgePreflight.headers.get("access-control-allow-private-network"),
      "true"
    );
    const bridgeTicketResponse = await fetch(
      `${matchBridge}?match=x3&variant=gladiador&fit=cover`,
      { headers: { Origin: "https://shenpulse-overlays.web.app" } }
    );
    assert.equal(bridgeTicketResponse.status, 200);
    assert.equal(
      bridgeTicketResponse.headers.get("access-control-allow-origin"),
      "https://shenpulse-overlays.web.app"
    );
    const bridgeTicket = await bridgeTicketResponse.json();
    assert.match(bridgeTicket.url, /^\/match-media\/[A-Za-z0-9_-]{32}$/);
    const bridgeMedia = await fetch(
      `http://127.0.0.1:${overlayPort}${bridgeTicket.url}`,
      {
        headers: {
          Origin: "https://shenpulse-overlays.web.app",
          Range: "bytes=0-63"
        }
      }
    );
    assert.equal(bridgeMedia.status, 206);
    assert.equal(bridgeMedia.headers.get("content-length"), "64");
    await bridgeMedia.body.cancel();
    const refusedBridge = await fetch(
      `${matchBridge}?match=x2&variant=tikcontrol`,
      { headers: { Origin: "https://malicious.example" } }
    );
    assert.equal(refusedBridge.status, 403);

    const protectedMatchEventStream = await fetch(
      `${proUrls.matchPlayer}/events`
    );
    const protectedMatchReader = protectedMatchEventStream.body.getReader();
    await protectedMatchReader.read();
    state.settings.matchAccess.accessKey = "b".repeat(32);
    server.refreshAccess();
    const regenerated = new TextDecoder().decode(
      (await protectedMatchReader.read()).value
    );
    assert.match(regenerated, /match-url-regenerated/);
    await protectedMatchReader.cancel();
    const matchEventStream = await fetch(
      `http://127.0.0.1:${overlayPort}/events?view=match&token=overlay-secret`
    );
    const matchReader = matchEventStream.body.getReader();
    await matchReader.read();
    const requestedMatch = server.playMatch({
      match: "x3",
      variant: "gladiador",
      fit: "cover"
    });
    const queuedMatch = new TextDecoder().decode((await matchReader.read()).value);
    assert.match(queuedMatch, /event: match/);
    assert.match(queuedMatch, /"match":"x3"/);
    assert.equal(requestedMatch.variant, "gladiador");
    assert.equal(requestedMatch.fit, "cover");
    await matchReader.cancel();

    const eventStream = await fetch(
      `http://127.0.0.1:${overlayPort}/events?view=win-counter&token=overlay-secret`
    );
    assert.equal(eventStream.status, 200);
    const reader = eventStream.body.getReader();
    const connected = new TextDecoder().decode((await reader.read()).value);
    assert.match(connected, /ShenPulse connected/);
    state.commerce.subscription.status = "revoked";
    server.publish("event", { type: "like" });
    const revoked = new TextDecoder().decode((await reader.read()).value);
    assert.match(revoked, /access-revoked/);
    await reader.cancel();
    assert.equal(server.urls().winCounter, "");
  } finally {
    await server.stop();
  }
});

test("calcule les droits Pro des sources locales et leurs vues protégées", () => {
  assert.equal(overlayViewRequiresPro("win-counter"), true);
  assert.equal(overlayViewRequiresPro("match"), true);
  assert.equal(overlayViewRequiresPro("like-goal"), false);
  assert.equal(
    hasProOverlayAccess({
      commerce: {
        subscription: {
          tier: "premium",
          source: "paid",
          status: "active"
        }
      }
    }),
    true
  );
  assert.equal(
    hasProOverlayAccess({
      commerce: {
        subscription: {
          tier: "pro",
          source: "trial",
          status: "trial",
          expiresAtMs: Date.now() - 1
        }
      }
    }),
    false
  );
  assert.equal(
    hasProOverlayAccess({
      commerce: {
        subscription: {
          tier: "pro",
          source: "paypal",
          status: "suspended"
        }
      }
    }),
    false
  );
});

test("normalise strictement chaque demande de lecture Match", () => {
  const request = normalizeMatchPlaybackRequest({
    match: "enigma",
    variant: "gladiador",
    fit: "cover"
  });
  assert.equal(request.match, "enigma");
  assert.equal(request.variant, "tikcontrol");
  assert.equal(request.fit, "cover");
  assert.match(request.requestId, /^[0-9a-f-]{36}$/i);
  assert.throws(
    () => normalizeMatchPlaybackRequest({ match: "inconnu" }),
    /Animation Match invalide/
  );
});

test("chaque source OBS ne reçoit que les canaux qui lui appartiennent", () => {
  assert.equal(overlayViewAcceptsChannel("win-counter", "win-counter"), true);
  assert.equal(
    overlayViewAcceptsChannel("win-counter", "session-state"),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel("win-counter", "event", { type: "gift" }),
    false
  );
  assert.equal(overlayViewAcceptsChannel("win-counter", "audio"), false);
  assert.equal(overlayViewAcceptsChannel("like-goal", "tts"), false);
  assert.equal(
    overlayViewAcceptsChannel("alerts", "audio", { screen: 3 }, 3),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel("alerts", "tts", { screen: 3 }, 2),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel("alerts", "audio", { screen: 3 }),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel("coin-jar", "event", { type: "gift" }),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel("coin-jar", "event", { type: "like" }),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel("like-goal", "event", { type: "like" }),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel(
      "leaderboard",
      "event",
      { type: "gift" },
      0,
      "donors"
    ),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel(
      "leaderboard",
      "event",
      { type: "like" },
      0,
      "donors"
    ),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel(
      "leaderboard",
      "event",
      { type: "like" },
      0,
      "tappers"
    ),
    true
  );
  assert.equal(
    overlayViewAcceptsChannel(
      "leaderboard",
      "event",
      { type: "gift" },
      0,
      "tappers"
    ),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel("match", "event", { type: "gift" }),
    false
  );
  assert.equal(
    overlayViewAcceptsChannel("match", "match", { match: "x2" }),
    true
  );
});
