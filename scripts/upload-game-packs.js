"use strict";

/** Publication immuable : sources et téléchargements publics vérifiés par taille et SHA-256. */
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { createHash } = require("node:crypto");
const { presignPutObjectUrl, publicMediaUrl } = require("../src/main/backblaze-media");
const { verifyLocalAsset } = require("./lib/installer-assets");
const { cachedGamePack, gamePackCachePath } = require("./lib/game-pack-cache");
const manifest = require("./manifests/game-packs.json");
const root = path.join(__dirname, "..");
const cache = path.join(root, ".artifacts", "game-pack-migration");
const config = {
  bucket: process.env.B2_MEDIA_BUCKET,
  endpoint: String(process.env.B2_MEDIA_ENDPOINT || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  region: process.env.B2_MEDIA_REGION,
  publicBaseUrl: String(process.env.B2_MEDIA_PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  keyId: process.env.B2_MEDIA_KEY_ID,
  applicationKey: process.env.B2_MEDIA_APPLICATION_KEY
};

async function verifyRemote(asset) {
  const response = await fetch(publicMediaUrl(config, asset.key), { signal: AbortSignal.timeout(180_000), cache: "no-store" });
  if (response.status === 404) { await response.body?.cancel(); return false; }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Lecture publique refusée (${response.status}) : ${asset.key}`); }
  let size = 0;
  const hash = createHash("sha256");
  for await (const chunk of Readable.fromWeb(response.body)) { size += chunk.length; hash.update(chunk); }
  if (size !== asset.size || hash.digest("hex") !== asset.sha256) {
    throw new Error(`Objet distant différent : ${asset.key}. Publication interrompue sans le remplacer.`);
  }
  return true;
}

async function main() {
  if (Object.values(config).some(value => !value)) throw new Error("Configuration Backblaze incomplète");
  if (config.publicBaseUrl !== "https://f003.backblazeb2.com/file/shenpulse-media") throw new Error("Destination différente des manifestes ShenPulse");
  await fs.promises.mkdir(cache, { recursive: true });
  const results = [];
  const requested = process.argv.filter(argument => argument.startsWith("--game=")).map(argument => argument.slice(7));
  for (const gameId of requested) if (!manifest.assets.some(asset => asset.gameId === gameId)) throw new Error(`Jeu absent du registre de publication : ${gameId}`);
  for (const asset of manifest.assets.filter(asset => !requested.length || requested.includes(asset.gameId))) {
    process.stdout.write(`${asset.gameId}/${asset.id} : `);
    let uploaded = false;
    if (!await verifyRemote(asset)) {
      if (process.argv.includes("--verify-only")) throw new Error(`Pack absent : ${asset.key}`);
      let source;
      // sourceUrl conserve la provenance, sans devenir un téléchargement à
      // l’exécution. Une restauration utilise notre copie vérifiée en cache.
      if (asset.sourceUrl) source = gamePackCachePath(asset);
      else {
        source = path.join(root, asset.buildPath);
        try { await verifyLocalAsset(source, asset); }
        catch { source = gamePackCachePath(asset); }
      }
      await verifyLocalAsset(source, asset);
      const url = presignPutObjectUrl({ config, key: asset.key, ttl: 3600 });
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": asset.key.endsWith(".zip") ? "application/zip" : "application/octet-stream", "Content-Length": String(asset.size) },
        body: fs.createReadStream(source), duplex: "half", signal: AbortSignal.timeout(300_000) });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`Envoi refusé (${response.status}) : ${asset.key}`);
      if (!await verifyRemote(asset)) throw new Error(`Pack absent après envoi : ${asset.key}`);
      uploaded = true;
    }
    results.push({ key: asset.key, size: asset.size, sha256: asset.sha256, uploaded, verified: true });
    process.stdout.write(`SHA-256 et taille vérifiés${uploaded ? " après envoi" : ""}\n`);
  }
  await fs.promises.writeFile(path.join(cache, requested.length ? "verification-selected.json" : "verification.json"), JSON.stringify({ verifiedAt: new Date().toISOString(), assets: results }, null, 2));
  process.stdout.write(`${results.length} packs disponibles et vérifiés sur Backblaze.\n`);
}

main().catch(error => { process.stderr.write(`\nÉchec : ${error.message}\n`); process.exitCode = 1; });
