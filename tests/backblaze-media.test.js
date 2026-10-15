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

test("accepte un fichier MP4 comme son personnalisé", async () => {
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
    path.join(os.tmpdir(), "shenpulse-sound-mp4-")
  );
  const soundPath = path.join(temporaryDirectory, "Alerte_Video.mp4");
  fs.writeFileSync(soundPath, Buffer.from("test-mp4-audio"));

  const sound = await service.uploadSound(soundPath);

  assert.equal(sound.name, "Alerte Video");
  assert.equal(sound.kind, "sound");
  assert.equal(sound.contentType, "audio/mp4");
  assert.match(sound.key, /^mediauploads\/desktop\/sound\/.+\.mp4$/);
  assert.equal(calls[0].options.headers["Content-Type"], "audio/mp4");
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

test("conserve le format GIF lors du téléversement d'un média personnalisé", async () => {
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
    path.join(os.tmpdir(), "shenpulse-media-gif-")
  );
  const gifPath = path.join(temporaryDirectory, "Alerte_Animee.gif");
  fs.writeFileSync(gifPath, Buffer.from("GIF89a"));

  const media = await service.uploadMedia(gifPath, "visual");

  assert.equal(media.name, "Alerte Animee");
  assert.equal(media.kind, "gif");
  assert.equal(media.contentType, "image/gif");
  assert.match(media.key, /^mediauploads\/desktop\/gif\/.+\.gif$/);
  assert.match(media.url, /\.gif$/);
  assert.equal(calls[0].options.headers["Content-Type"], "image/gif");
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

function managedUpload(contentType, size, key = "mediauploads/member-a/test.mp3") {
  return {
    ok: true,
    media: { contentType, size, key, publicUrl: `https://f003.backblazeb2.com/file/shenpulse-media/${key}` },
    upload: {
      method: "PUT",
      url: `https://shenpulse-media.s3.eu-central-003.backblazeb2.com/${key}?X-Amz-Signature=test-signature`,
      headers: { "Content-Type": contentType },
      expiresAt: new Date(Date.now() + 60000).toISOString()
    }
  };
}

async function withManagedFile(extension, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-managed-media-"));
  try {
    const filePath = path.join(directory, `Mon_Media${extension}`);
    fs.writeFileSync(filePath, Buffer.from("test-content"));
    const store = createStore();
    store.state.settings.account = { uid: "member-a" };
    // Une installation standard ne possède et ne doit jamais lire les clés B2.
    store.getSecret = () => { throw new Error("Aucune clé B2 sur ce poste utilisateur"); };
    await run({ filePath, store, size: fs.statSync(filePath).size });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("le stockage géré importe tous les médias pour un compte ordinaire sans clés locales", async () => {
  for (const [extension, requestedKind, expectedKind, contentType] of [
    [".mp3", "sound", "sound", "audio/mpeg"],
    [".wav", "sound", "sound", "audio/wav"],
    [".m4a", "sound", "sound", "audio/mp4"],
    [".ogg", "sound", "sound", "audio/ogg"],
    [".mp4", "sound", "sound", "audio/mp4"],
    [".webm", "sound", "sound", "audio/webm"],
    [".png", "visual", "image", "image/png"],
    [".jpg", "visual", "image", "image/jpeg"],
    [".jpeg", "visual", "image", "image/jpeg"],
    [".webp", "visual", "image", "image/webp"],
    [".gif", "visual", "gif", "image/gif"],
    [".mp4", "visual", "video", "video/mp4"],
    [".webm", "visual", "video", "video/webm"]
  ]) await withManagedFile(extension, async ({ filePath, store, size }) => {
    const calls = [];
    const target = managedUpload(contentType, size, `mediauploads/member-a/test${extension === ".jpeg" ? ".jpg" : extension}`);
    const service = new BackblazeMediaService({
      store,
      createUpload: async (incoming) => { calls.push(incoming); return target; },
      fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200 }; }
    });
    assert.deepEqual(service.importEnvironmentConfiguration(), { configured: true, managed: true, maxBytes: 209715200 });
    const media = await service.uploadMedia(filePath, requestedKind, { expectedUid: "member-a" });
    assert.deepEqual(calls[0], { fileName: `Mon_Media${extension}`, contentType, size, expectedUid: "member-a" });
    assert.equal(media.kind, expectedKind);
    assert.equal(media.name, "Mon Media");
    assert.equal(media.url, target.media.publicUrl);
    assert.equal(media.key, target.media.key);
    assert.equal(calls[1].options.headers["Content-Type"], contentType);
    assert.equal(calls[1].options.headers["Content-Length"], String(size));
    assert.equal(calls[1].options.headers.Authorization, undefined);
    assert.equal(calls[1].options.redirect, "error");
    assert.equal(calls[1].options.credentials, "omit");
    assert.ok(calls[1].options.signal);
    assert.doesNotMatch(JSON.stringify(media), /Signature|test-signature/);
  });
});

test("un refus du courtier ne déclenche jamais une signature locale de secours", async () => {
  await withManagedFile(".mp3", async ({ filePath, store }) => {
    let puts = 0;
    const service = new BackblazeMediaService({ store,
      createUpload: async () => { throw new Error("Quota média atteint"); },
      fetchImpl: async () => { puts += 1; }
    });
    await assert.rejects(service.uploadSound(filePath, { expectedUid: "member-a" }), /Quota média atteint/);
    assert.equal(puts, 0);
  });
});

test("le transfert refuse une autorisation incohérente ou une destination étrangère", async () => {
  await withManagedFile(".mp3", async ({ filePath, store, size }) => {
    for (const corrupt of [
      (target) => { target.media.size += 1; },
      (target) => { target.media.contentType = "video/mp4"; },
      (target) => { target.upload.method = "POST"; },
      (target) => { target.upload.url = "https://attacker.example/collect"; },
      (target) => { target.upload.url = target.upload.url.replace("https:", "http:"); },
      (target) => { target.media.publicUrl = "https://attacker.example/file.mp3"; },
      (target) => { target.media.publicUrl += "?token=secret"; },
      (target) => { target.media.key = "mediauploads/another-user/test.mp3"; },
      (target) => { target.upload.headers.Authorization = "Bearer forbidden"; },
      (target) => { target.upload.headers["Content-Type"] = "video/mp4"; },
      (target) => { target.upload.headers["Content-Length"] = "999"; },
      (target) => { target.upload.expiresAt = "2020-01-01T00:00:00.000Z"; }
    ]) {
      let puts = 0;
      const target = managedUpload("audio/mpeg", size);
      corrupt(target);
      const service = new BackblazeMediaService({ store, createUpload: async () => target,
        fetchImpl: async () => { puts += 1; return { ok: true }; }
      });
      await assert.rejects(service.uploadSound(filePath, { expectedUid: "member-a" }), /autorisation média invalide/);
      assert.equal(puts, 0);
    }
  });
});

test("un changement de compte au courtier ou pendant le PUT ne rend aucun média à sauvegarder", async () => {
  for (const phase of ["before", "broker", "put"]) await withManagedFile(".mp3", async ({ filePath, store, size }) => {
    let prepares = 0, puts = 0;
    if (phase === "before") store.state.settings.account.uid = "member-b";
    const service = new BackblazeMediaService({ store,
      createUpload: async () => {
        prepares += 1;
        if (phase === "broker") store.state.settings.account.uid = "member-b";
        return managedUpload("audio/mpeg", size);
      },
      fetchImpl: async () => {
        puts += 1;
        if (phase === "put") store.state.settings.account.uid = "member-b";
        return { ok: true, status: 200 };
      }
    });
    await assert.rejects(service.uploadSound(filePath, { expectedUid: "member-a" }), { code: "MEDIA_ACCOUNT_CHANGED" });
    assert.equal(prepares, phase === "before" ? 0 : 1);
    assert.equal(puts, phase === "put" ? 1 : 0);
  });
});

test("les fichiers vides, non autorisés ou trop grands sont refusés avant le courtier", async () => {
  await withManagedFile(".mp3", async ({ filePath, store }) => {
    let prepares = 0;
    const service = new BackblazeMediaService({ store, createUpload: async () => { prepares += 1; } });
    await assert.rejects(service.uploadSound(`${filePath}.exe`, { expectedUid: "member-a" }), /Format audio/);
    fs.truncateSync(filePath, 0);
    await assert.rejects(service.uploadSound(filePath, { expectedUid: "member-a" }), /vide/);
    fs.truncateSync(filePath, 209715201);
    await assert.rejects(service.uploadSound(filePath, { expectedUid: "member-a" }), /volumineux/);
    assert.equal(prepares, 0);
  });
});
