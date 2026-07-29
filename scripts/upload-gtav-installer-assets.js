"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  parseEnvironmentFile,
  presignPutObjectUrl,
  publicMediaUrl
} = require("../src/main/backblaze-media");

const root = path.join(__dirname, "..");
const options = parseArguments(process.argv.slice(2));
const manifestPath = options.manifest
  ? path.resolve(options.manifest)
  : path.join(
      root,
      "resources",
      "installer-assets",
      "gtav-montchiliad",
      "1.0.0",
      "manifest.json"
    );
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const environment = options.env
  ? parseEnvironmentFile(
      fs.readFileSync(path.resolve(options.env), "utf8")
    )
  : process.env;
const config = backblazeConfiguration(environment);
const sourceRoot = path.resolve(requiredOption("source-root"));
const enhancedHook = options["enhanced-hook"]
  ? path.resolve(options["enhanced-hook"])
  : "";
const suppliedSave = options.save ? path.resolve(options.save) : "";
const remotePrefix = [
  "installer-assets",
  manifest.gameId,
  manifest.version
].join("/");

main().catch((error) => {
  process.stderr.write(`Échec : ${error.message}\n`);
  process.exitCode = 1;
});

async function main() {
  const only = String(options.only || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const uploadOrder = manifest.assets.filter(
    () => options["manifest-only"] !== "true"
  ).filter(
    (asset) => !only.length || only.includes(asset.id)
  ).sort(
    (left, right) => left.size - right.size
  );
  for (let index = 0; index < uploadOrder.length; index += 1) {
    const asset = uploadOrder[index];
    const sourcePath = sourcePathFor(asset);
    const key = `${remotePrefix}/${asset.remoteName}`;
    process.stdout.write(
      `[${index + 1}/${uploadOrder.length}] Vérification ${asset.remoteName}\n`
    );
    await verifyLocalAsset(sourcePath, asset);
    if (await remoteHasExpectedSize(config, key, asset.size)) {
      process.stdout.write(`    Déjà présent sur Backblaze (${asset.size} octets)\n`);
      continue;
    }
    process.stdout.write(`    Envoi vers ${key}\n`);
    await uploadFile(config, key, sourcePath, asset.sha256);
    if (!(await remoteHasExpectedSize(config, key, asset.size))) {
      throw new Error(
        `la vérification distante a échoué pour ${asset.remoteName}`
      );
    }
    process.stdout.write(`    Upload vérifié (${asset.size} octets)\n`);
  }

  if (only.length) return;
  const manifestKey = `${remotePrefix}/manifest.json`;
  const manifestHash = await sha256File(manifestPath);
  await uploadFile(config, manifestKey, manifestPath, manifestHash);
  if (
    !(await remoteHasExpectedSize(
      config,
      manifestKey,
      fs.statSync(manifestPath).size
    ))
  ) {
    throw new Error("la vérification distante du manifeste a échoué");
  }
  process.stdout.write(
    `Terminé : ${publicMediaUrl(config, manifestKey)}\n`
  );
}

function sourcePathFor(asset) {
  if (asset.id === "scripthook-enhanced" && enhancedHook) return enhancedHook;
  if (asset.id === "enhancedsave" && suppliedSave) return suppliedSave;
  return path.join(sourceRoot, asset.sourceName);
}

async function verifyLocalAsset(filePath, asset) {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error(`source introuvable : ${filePath}`);
  }
  if (stat.size !== asset.size) {
    throw new Error(
      `taille inattendue pour ${asset.sourceName} (${stat.size} au lieu de ${asset.size})`
    );
  }
  const actualHash = await sha256File(filePath);
  if (actualHash !== asset.sha256) {
    throw new Error(`empreinte SHA-256 inattendue pour ${asset.sourceName}`);
  }
}

async function uploadFile(config, key, filePath, sha256) {
  const uploadUrl = presignPutObjectUrl({
    config,
    key,
    ttl: 3600
  });
  await run("curl.exe", [
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "5",
    "--retry-all-errors",
    "--header",
    `Content-Type: ${contentTypeFor(filePath)}`,
    "--upload-file",
    filePath,
    uploadUrl
  ]);
}

async function remoteHasExpectedSize(config, key, expectedSize) {
  const response = await fetch(publicMediaUrl(config, key), {
    method: "HEAD",
    cache: "no-store"
  }).catch(() => null);
  return Boolean(
    response?.ok &&
      Number(response.headers.get("content-length") || 0) === expectedSize
  );
}

function run(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${file} a échoué avec le code ${code}`));
    });
  });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function backblazeConfiguration(values) {
  const endpoint = String(values.B2_MEDIA_ENDPOINT || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const publicBaseUrl = String(values.B2_MEDIA_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const config = {
    bucket: String(values.B2_MEDIA_BUCKET || "").trim(),
    endpoint,
    region:
      String(values.B2_MEDIA_REGION || "").trim() ||
      endpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i)?.[1] ||
      "",
    keyId: String(values.B2_MEDIA_KEY_ID || "").trim(),
    applicationKey: String(values.B2_MEDIA_APPLICATION_KEY || "").trim(),
    publicBaseUrl
  };
  if (
    !config.bucket ||
    !config.endpoint ||
    !config.region ||
    !config.keyId ||
    !config.applicationKey ||
    !config.publicBaseUrl
  ) {
    throw new Error("configuration Backblaze incomplète");
  }
  return config;
}

function contentTypeFor(filePath) {
  return {
    ".asi": "application/octet-stream",
    ".json": "application/json",
    ".rar": "application/vnd.rar",
    ".zip": "application/zip"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function parseArguments(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = String(args[index] || "").replace(/^--/, "");
    if (key) result[key] = args[index + 1] || "";
  }
  return result;
}

function requiredOption(name) {
  const value = options[name];
  if (!value) throw new Error(`option --${name} manquante`);
  return value;
}
