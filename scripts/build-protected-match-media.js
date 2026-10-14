"use strict";

/** Produit les ressources privées, sans exporter la clé ni téléverser de vidéo. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const catalog = require("../resources/overlays/overlay-catalog");
const { FORMAT_VERSION, MAX_VIDEO_BYTES, MEDIA_NAME, encryptMedia } = require("../src/main/match-media/format");
const PUBLIC_OVERLAY_ROOT = path.resolve(__dirname, "..", require("../firebase.json").hosting.public);

function writeGeneratedAtomically(target, contents) {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, contents);
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function buildProtectedMatchMedia({ sourceDirectory, outputDirectory, definitions = catalog.definitions } = {}) {
  const sourceRoot = path.resolve(sourceDirectory || path.join(__dirname, "../resources/overlays/media/video"));
  const outputRoot = path.resolve(outputDirectory || path.join(__dirname, "../resources/protected-match-media"));
  if (outputRoot === sourceRoot || outputRoot.startsWith(`${sourceRoot}${path.sep}`) ||
      outputRoot === PUBLIC_OVERLAY_ROOT || outputRoot.startsWith(`${PUBLIC_OVERLAY_ROOT}${path.sep}`)) {
    throw new Error("Les ressources privées doivent rester hors du dossier public des overlays.");
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  const keyPath = path.join(outputRoot, "client-key.json");
  let key;
  const newKey = !fs.existsSync(keyPath);
  if (fs.existsSync(keyPath)) {
    const stored = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    if (stored.version !== FORMAT_VERSION) throw new Error("Version de clé Match incompatible.");
    key = Buffer.from(stored.key, "base64");
    if (key.length !== 32) throw new Error("Clé de lecture Match invalide.");
  } else {
    key = crypto.randomBytes(32);
    writeGeneratedAtomically(keyPath, JSON.stringify({ version: FORMAT_VERSION, key: key.toString("base64") }));
  }
  const manifestPath = path.join(outputRoot, "manifest.json");
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  const entries = {};
  let rebuilt = 0;
  try {
    for (const definition of definitions.filter((item) => item.previewKind === "match")) {
      for (const [variant] of definition.options) {
        const name = `${definition.match}-${variant}.webm`;
        if (!MEDIA_NAME.test(name)) throw new Error("Nom de vidéo Match invalide.");
        const targetName = `${name}.spm`;
        const source = fs.readFileSync(path.join(sourceRoot, name));
        try {
          if (!source.length || source.length > MAX_VIDEO_BYTES) throw new Error(`Vidéo Match trop volumineuse : ${name}`);
          const sha256 = crypto.createHash("sha256").update(source).digest("hex");
          const target = path.join(outputRoot, targetName);
          const previousEntry = previous.entries?.[name];
          let encryptedSha256 = previousEntry?.encryptedSha256;
          const reusable = !newKey && previous.version === FORMAT_VERSION && previousEntry?.size === source.length &&
            previousEntry?.sha256 === sha256 && previousEntry?.file === targetName && fs.existsSync(target) &&
            fs.statSync(target).size === source.length + 28 && crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex") === encryptedSha256;
          if (!reusable) {
            const encrypted = encryptMedia(source, key, name);
            encryptedSha256 = crypto.createHash("sha256").update(encrypted).digest("hex");
            writeGeneratedAtomically(target, encrypted);
            rebuilt += 1;
          }
          entries[name] = { file: targetName, size: source.length, sha256, encryptedSha256 };
        } finally { source.fill(0); }
      }
    }
    writeGeneratedAtomically(manifestPath, JSON.stringify({ version: FORMAT_VERSION, entries }, null, 2));
    return { count: Object.keys(entries).length, rebuilt };
  } finally { key.fill(0); }
}

if (require.main === module) {
  const result = buildProtectedMatchMedia();
  process.stdout.write(`Médias Match privés prêts : ${result.count} vidéos, ${result.rebuilt} ressources actualisées.\n`);
}
module.exports = { buildProtectedMatchMedia };
