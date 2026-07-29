"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  BackblazeMediaService,
  parseEnvironmentFile,
  presignPutObjectUrl
} = require("../src/main/backblaze-media");

function createStore(backblaze = {}) {
  const secrets = new Map();
  const state = {
    settings: {
      backblaze: {
        bucket: "shenpulse-media",
        endpoint: "s3.eu-central-003.backblazeb2.com",
        region: "eu-central-003",
        prefix: "mediauploads",
        publicBaseUrl:
          "https://f003.backblazeb2.com/file/shenpulse-media",
        maxBytes: 10 * 1024 * 1024,
        keyIdSecretId: "",
        applicationKeySecretId: "",
        ...backblaze
      }
    },
    customSounds: []
  };
  return {
    getState: () => structuredClone(state),
    set: (key, value) => {
      if (key === "settings.backblaze") state.settings.backblaze = value;
    },
    mutate: (mutator) => mutator(state),
    setSecret: (secretId, value) => {
      const id = secretId || `secret_${secrets.size + 1}`;
      secrets.set(id, value);
      return id;
    },
    getSecret: (secretId) => secrets.get(secretId) || "",
    secrets,
    state
  };
}

test("importe la configuration Backblaze sans exposer les clés dans l'état", () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-b2-")
  );
  const environmentPath = path.join(temporaryDirectory, ".env");
  fs.writeFileSync(
    environmentPath,
    [
      "B2_MEDIA_BUCKET=shenpulse-media",
      "B2_MEDIA_ENDPOINT=s3.eu-central-003.backblazeb2.com",
      "B2_MEDIA_REGION=eu-central-003",
      "B2_MEDIA_KEY_ID=test-key-id",
      "B2_MEDIA_APPLICATION_KEY=test-application-key",
      "B2_MEDIA_PREFIX=mediauploads",
      "B2_MEDIA_PUBLIC_BASE_URL=https://f003.backblazeb2.com/file/shenpulse-media"
    ].join("\n")
  );
  const store = createStore();
  const service = new BackblazeMediaService({
    store,
    environmentPaths: [environmentPath]
  });

  const status = service.importEnvironmentConfiguration();

  assert.equal(status.configured, true);
  assert.ok(store.state.settings.backblaze.keyIdSecretId);
  assert.ok(store.state.settings.backblaze.applicationKeySecretId);
  assert.equal("keyId" in store.state.settings.backblaze, false);
  assert.equal("applicationKey" in store.state.settings.backblaze, false);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("signe et téléverse un son personnalisé vers Backblaze", async () => {
  const store = createStore({
    keyIdSecretId: "key-id",
    applicationKeySecretId: "application-key"
  });
  store.secrets.set("key-id", "test-key-id");
  store.secrets.set("application-key", "test-application-key");
  const calls = [];
  const service = new BackblazeMediaService({
    store,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    }
  });
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-sound-")
  );
  const soundPath = path.join(temporaryDirectory, "Mon_Son.mp3");
  fs.writeFileSync(soundPath, Buffer.from("test-audio"));

  const sound = await service.uploadSound(soundPath);

  assert.equal(sound.name, "Mon Son");
  assert.equal(sound.category, "custom");
  assert.match(sound.url, /^https:\/\/f003\.backblazeb2\.com\/file\/shenpulse-media\/mediauploads\/desktop\//);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "PUT");
  assert.match(calls[0].url, /X-Amz-Signature=/);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("téléverse aussi une image personnalisée dans la bibliothèque globale", async () => {
  const store = createStore({
    keyIdSecretId: "key-id",
    applicationKeySecretId: "application-key"
  });
  store.secrets.set("key-id", "test-key-id");
  store.secrets.set("application-key", "test-application-key");
  const calls = [];
  const service = new BackblazeMediaService({
    store,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200 };
    }
  });
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-media-")
  );
  const imagePath = path.join(temporaryDirectory, "Alerte_Cadeau.png");
  fs.writeFileSync(imagePath, Buffer.from("test-image"));

  const media = await service.uploadMedia(imagePath, "visual");

  assert.equal(media.name, "Alerte Cadeau");
  assert.equal(media.kind, "image");
  assert.equal(media.source, "custom");
  assert.equal(media.contentType, "image/png");
  assert.match(media.key, /^mediauploads\/desktop\/image\/.+\.png$/);
  assert.equal(calls[0].options.headers["Content-Type"], "image/png");
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("le parseur et la signature B2 restent déterministes", () => {
  assert.deepEqual(parseEnvironmentFile('A="un"\nB=deux\n# C=trois'), {
    A: "un",
    B: "deux"
  });
  const url = presignPutObjectUrl({
    config: {
      bucket: "shenpulse-media",
      endpoint: "s3.eu-central-003.backblazeb2.com",
      region: "eu-central-003",
      keyId: "key-id",
      applicationKey: "application-key"
    },
    key: "mediauploads/desktop/test.mp3",
    now: new Date("2026-07-27T10:00:00.000Z")
  });
  assert.match(url, /X-Amz-Date=20260727T100000Z/);
  assert.match(url, /X-Amz-Signature=[a-f0-9]{64}$/);
});
