"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const {
  OverlayServer,
  hasProOverlayAccess,
  overlayViewRequiresPro
} = require("../src/main/overlay-server");

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
      apiToken: "api-secret"
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
    assert.equal(liveStylesheet.headers.get("cache-control"), "no-store");
    const liveScript = await fetch(
      `http://127.0.0.1:${overlayPort}/overlay/overlay.js`
    );
    assert.equal(liveScript.status, 200);
    assert.equal(liveScript.headers.get("cache-control"), "no-store");
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
    assert.match(proUrls.winCounter, /view=win-counter/);
    const proDocument = await fetch(proUrls.winCounter);
    assert.equal(proDocument.status, 200);

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
