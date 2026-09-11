"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertAdminAccount,
  assertAuthenticatedAccount,
  createGuestSnapshot,
  hasAuthenticatedAccount,
  shouldSuppressRendererChannel,
  snapshotForRenderer
} = require("../src/main/account-access");

function createStore({ authenticated = false } = {}) {
  const state = {
    settings: {
      account: authenticated
        ? {
            email: "viewer@example.com",
            uid: "firebase-uid",
            refreshTokenSecretId: "secret_account"
          }
        : {
            email: "",
            uid: "",
            refreshTokenSecretId: ""
          }
    }
  };
  return {
    getState: () => state,
    getSecret: (id) =>
      authenticated && id === "secret_account"
        ? "firebase-refresh-token"
        : ""
  };
}

test("reconnaît uniquement une session locale complète et chiffrée", () => {
  assert.equal(hasAuthenticatedAccount(createStore()), false);
  assert.equal(
    hasAuthenticatedAccount(createStore({ authenticated: true })),
    true
  );
  assert.throws(
    () => assertAuthenticatedAccount(createStore()),
    (error) =>
      error.code === "ACCOUNT_REQUIRED" &&
      /Connectez-vous/.test(error.message)
  );
});

test("réserve les commandes d’administration au compte propriétaire vérifié", () => {
  const state = {
    settings: {
      account: {
        email: "alexandre.leuridan@gmail.com",
        emailVerified: true,
        uid: "owner-uid",
        refreshTokenSecretId: "owner-secret"
      }
    }
  };
  const store = {
    getState: () => state,
    getSecret: () => "refresh-token"
  };
  assert.equal(assertAdminAccount(store), true);
  state.settings.account.email = "another@example.com";
  assert.throws(
    () => assertAdminAccount(store),
    (error) => error.code === "ADMIN_ACCOUNT_REQUIRED"
  );
});

test("masque les URL, les sources, le journal et les médias personnels aux invités", () => {
  const snapshot = {
    state: {
      settings: {
        account: {
          email: "viewer@example.com",
          uid: "uid",
          refreshTokenSecretId: "account-secret"
        },
        admin: {
          email: "owner@example.com",
          uid: "admin",
          refreshTokenSecretId: "admin-secret"
        },
        apiToken: "api-token",
        overlayToken: "overlay-token",
        obs: { url: "ws://127.0.0.1:4455" },
        tiktok: { username: "private_account", status: "live" }
      },
      activity: [{ title: "Cadeau reçu" }],
      connections: [{ id: "source_tiktok", name: "TikTok privé" }],
      statistics: {
        sessionEvents: 99,
        sessionActions: 12,
        sessionLikes: 800,
        sessionUniqueViewers: ["one"]
      },
      session: {
        running: true,
        startedAt: "2026-07-29T10:00:00.000Z",
        activeConnectionIds: ["source_tiktok"],
        game: { running: true, packId: "gtav-montchiliad" }
      },
      customSounds: [
        {
          id: "custom-sound",
          url: "https://cdn.example/custom.mp3"
        }
      ],
      customMedia: [
        {
          id: "custom-media",
          url: "https://cdn.example/custom.png"
        }
      ],
      rules: [
        {
          id: "rule",
          actions: [
            {
              type: "system.open",
              config: { url: "https://private.example/action" }
            }
          ]
        }
      ],
      game: {
        connectorOverrides: {
          gta: { url: "ws://127.0.0.1:9999" }
        },
        installations: {
          gta: { directory: "C:\\Private\\GTA" }
        },
        activeEffects: [{ id: "effect" }]
      }
    },
    packs: [{ id: "game-public", name: "Jeu public" }],
    soundCatalog: [
      { id: "builtin", url: "/audio/builtin.mp3" },
      { id: "custom-sound", url: "https://cdn.example/custom.mp3" }
    ],
    mediaCatalog: [
      { id: "builtin-media", url: "/media/builtin.png" },
      { id: "custom-media", url: "https://cdn.example/custom.png" }
    ],
    overlayUrls: {
      likeGoal: "https://relay.example/private-like-goal"
    },
    localOverlayUrls: {
      base: "http://127.0.0.1:17654",
      likeGoal:
        "http://127.0.0.1:17654/overlay/?view=like-goal&token=secret",
      api: "http://127.0.0.1:21213/api?token=secret"
    },
    publicOverlayRelay: {
      connected: true,
      channelId: "private-channel"
    }
  };

  const guest = createGuestSnapshot(snapshot);
  assert.deepEqual(guest.overlayUrls, {});
  assert.deepEqual(guest.localOverlayUrls, {});
  assert.equal(
    guest.previewOverlayUrls.likeGoal.includes("127.0.0.1"),
    true
  );
  assert.equal("api" in guest.previewOverlayUrls, false);
  assert.deepEqual(guest.state.activity, []);
  assert.deepEqual(guest.state.connections, []);
  assert.deepEqual(guest.state.customSounds, []);
  assert.deepEqual(guest.state.customMedia, []);
  assert.equal(guest.state.settings.apiToken, "");
  assert.equal(guest.state.settings.overlayToken, "");
  assert.equal(guest.state.settings.obs.url, "");
  assert.equal(guest.state.settings.account.email, "");
  assert.equal(guest.state.settings.tiktok.username, "");
  assert.equal(guest.state.statistics.sessionEvents, 0);
  assert.equal(guest.state.session.running, false);
  assert.equal(guest.state.session.game.running, false);
  assert.equal(
    guest.state.rules[0].actions[0].config.url,
    ""
  );
  assert.deepEqual(guest.state.game.connectorOverrides, {});
  assert.deepEqual(guest.state.game.installations, {});
  assert.deepEqual(
    guest.soundCatalog.map((item) => item.id),
    ["builtin"]
  );
  assert.deepEqual(
    guest.mediaCatalog.map((item) => item.id),
    ["builtin-media"]
  );
  assert.deepEqual(guest.packs, snapshot.packs);
});

test("conserve l’instantané complet pour un compte connecté", () => {
  const snapshot = { state: { activity: [{ id: "private" }] } };
  assert.equal(
    snapshotForRenderer(
      snapshot,
      createStore({ authenticated: true })
    ),
    snapshot
  );
});

test("ne transmet les jeux ownerOnly qu’au compte propriétaire vérifié", () => {
  const snapshot = {
    state: { activity: [] },
    packs: [
      { id: "regular" },
      { id: "fortnite", ownerOnly: true }
    ]
  };
  const viewerSnapshot = snapshotForRenderer(
    snapshot,
    createStore({ authenticated: true })
  );
  assert.deepEqual(
    viewerSnapshot.packs.map((pack) => pack.id),
    ["regular"]
  );

  const ownerState = {
    settings: {
      account: {
        email: "alexandre.leuridan@gmail.com",
        emailVerified: true,
        uid: "owner-uid",
        refreshTokenSecretId: "owner-secret"
      }
    }
  };
  const ownerStore = {
    getState: () => ownerState,
    getSecret: (id) => (id === "owner-secret" ? "refresh-token" : "")
  };
  assert.equal(snapshotForRenderer(snapshot, ownerStore), snapshot);
});

test("coupe les événements privés envoyés au rendu en mode invité", () => {
  const guestStore = createStore();
  assert.equal(
    shouldSuppressRendererChannel("live-event", guestStore),
    true
  );
  assert.equal(
    shouldSuppressRendererChannel("playback", guestStore),
    true
  );
  assert.equal(
    shouldSuppressRendererChannel("state-changed", guestStore),
    false
  );
});

test("l’interface invitée reste navigable mais verrouille données et commandes", () => {
  const renderer = readRendererSource();
  const ipc = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "ipc.js"),
    "utf8"
  );
  assert.match(
    renderer,
    /page\.id === "activity" && !isAccountAuthenticated\(\)/
  );
  assert.match(renderer, /function applyGuestReadOnlyMode\(root\)/);
  assert.match(renderer, /function requireAccountForAction\(action\)/);
  assert.match(renderer, /function renderPrivateDataPlaceholder/);
  assert.match(
    renderer,
    /Aucune URL locale ou publique n’est affichée/
  );
  assert.match(
    renderer,
    /Les adresses, identifiants, ports, jetons et secrets/
  );
  assert.match(ipc, /assertAuthenticatedAccount\(store\)/);
  assert.match(ipc, /snapshotForRenderer\(core\.snapshot\(\), store\)/);
  const guestChannels = ipc.slice(
    ipc.indexOf("const guestAllowedChannels"),
    ipc.indexOf("const handle =", ipc.indexOf("const guestAllowedChannels"))
  );
  assert.doesNotMatch(guestChannels, /clipboard:write/);
  assert.doesNotMatch(guestChannels, /settings:save/);
  assert.doesNotMatch(guestChannels, /entity:upsert/);
  assert.doesNotMatch(guestChannels, /sound:upload/);
});

test("le visiteur peut essayer localement les designs et animations d’overlays", () => {
  const renderer = readRendererSource();
  const guestActions = renderer.slice(
    renderer.indexOf("const GUEST_BROWSING_ACTIONS"),
    renderer.indexOf("function renderGuestAccessNotice")
  );
  const guestPreview = renderer.slice(
    renderer.indexOf("function previewGuestOverlay"),
    renderer.indexOf("async function previewOverlay")
  );
  assert.match(guestActions, /"preview-overlay"/);
  assert.match(renderer, /control\.matches\("\[data-overlay-design\]"\)/);
  assert.match(renderer, /Essai local et temporaire/);
  assert.match(
    renderer,
    /previewOverlayDesignSelection\(item, picker\.value\)/
  );
  assert.match(guestPreview, /postOverlayCardEvent/);
  assert.doesNotMatch(guestPreview, /\bapi\./);
});
