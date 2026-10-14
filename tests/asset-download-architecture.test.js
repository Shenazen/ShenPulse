"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { downloadAsset } = require("../src/main/game-runtime/asset-download");

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-download-contract-"));
  const original = globalThis.fetch;
  try { await run(root); }
  finally { globalThis.fetch = original; await fs.rm(root, { recursive: true, force: true }); }
}

test("un téléchargement simulé garde intégrité, progression et publication atomique", () => fixture(async (root) => {
  const bytes = Buffer.from("asset vérifié");
  const requests = [];
  const progress = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(bytes, { headers: { "content-length": String(bytes.length) } });
  };
  const destination = path.join(root, "asset.zip");
  await downloadAsset({ progress: (id, entry) => progress.push({ id, ...entry }) }, "game", {
    id: "asset", url: "https://assets.backblazeb2.com/file/asset.zip", size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  }, destination, { index: 1, total: 3 });
  assert.deepEqual(await fs.readFile(destination), bytes);
  await assert.rejects(fs.stat(destination + ".partial"), /ENOENT/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.redirect, "follow");
  assert.ok(requests[0].options.signal instanceof AbortSignal);
  assert.ok(progress.every((entry) => entry.id === "game" && entry.current === 2 && entry.total === 3));
  assert.equal(progress.at(-1).downloadPercent, 100);
}));

test("une taille ou empreinte incorrecte ne publie jamais le fichier final", () => fixture(async (root) => {
  globalThis.fetch = async () => new Response(Buffer.from("wrong"), { headers: { "content-length": "5" } });
  const runtime = { progress() {} };
  const asset = { id: "asset", url: "https://assets.backblazeb2.com/file/asset.zip" };
  const destination = path.join(root, "asset.zip");
  await assert.rejects(downloadAsset(runtime, "game", { ...asset, size: 6 }, destination), /version publiée/);
  await assert.rejects(fs.stat(destination), /ENOENT/);
  await assert.rejects(downloadAsset(runtime, "game", { ...asset, size: 5, sha256: "0".repeat(64) }, destination), /intégrité/);
  await assert.rejects(fs.stat(destination), /ENOENT/);
}));

test("les URLs non autorisées sont refusées avant tout appel réseau", () => fixture(async (root) => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("réseau interdit"); };
  await assert.rejects(downloadAsset({ progress() {} }, "game", { id: "asset", url: "https://untrusted.example/asset.zip" }, path.join(root, "asset.zip")), /non autorisé/);
  assert.equal(calls, 0);
}));
