"use strict";

// Import des sorties de l’outil intégré : aucune clé, connexion ou génération API.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const artRoot = path.join(root, "resources/game-interaction-art");
const registryPath = path.join(root, "resources/catalogs/game-interaction-art.json");
const planPath = path.join(root, ".tmp/interaction-art-plan.json");

function importArt(resultsPath) {
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const jobs = new Map(plan.entries.map(entry => [`${entry.gameId}/${entry.effectId}`, entry]));
  const work = path.join(root, ".tmp/interaction-art-import");
  fs.mkdirSync(work, { recursive: true });
  const converted = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-interaction-art-"));
  const pairs = [];
  for (const result of results) {
    const job = jobs.get(`${result.gameId}/${result.effectId}`);
    if (!job || !result.source || !fs.statSync(result.source).isFile()) throw new Error("Generated image or job missing");
    const destination = path.resolve(artRoot, job.file);
    if (!destination.startsWith(artRoot + path.sep)) throw new Error("Unsafe image path");
    pairs.push(`${result.source}\t${path.join(converted, job.file)}`);
  }
  const list = path.join(work, "files.tsv");
  fs.writeFileSync(list, pairs.join("\n"), "utf8");
  const compiler = path.join(process.env.WINDIR || "C:/Windows", "Microsoft.NET/Framework/v4.0.30319/csc.exe");
  const executable = path.join(work, "Thumbnail.exe");
  const compile = spawnSync(compiler, ["/nologo", "/reference:System.Drawing.dll", `/out:${executable}`, path.join(__dirname, "interaction-art-thumbnail.cs")], { encoding: "utf8", windowsHide: true });
  if (compile.status !== 0) throw new Error(compile.stdout || compile.stderr || "Thumbnail compiler failed");
  const run = spawnSync(executable, [list], { encoding: "utf8", windowsHide: true });
  if (run.status !== 0) throw new Error(run.stdout || run.stderr || "Thumbnail import failed");
  const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : { schemaVersion: 1, generator: "image_gen built-in", entries: [] };
  const entries = new Map(registry.entries.map(entry => [`${entry.gameId}/${entry.effectId}`, entry]));
  for (const result of results) {
    const job = jobs.get(`${result.gameId}/${result.effectId}`);
    const destination = path.join(artRoot, job.file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (!fs.existsSync(destination)) fs.copyFileSync(path.join(converted, job.file), destination);
    const bytes = fs.readFileSync(path.join(artRoot, job.file));
    entries.set(`${job.gameId}/${job.effectId}`, { gameId: job.gameId, effectId: job.effectId, file: job.file,
      sha256: createHash("sha256").update(bytes).digest("hex"), prompt: job.prompt });
  }
  registry.entries = [...entries.values()].sort((a, b) => `${a.gameId}/${a.effectId}`.localeCompare(`${b.gameId}/${b.effectId}`, "en"));
  fs.writeFileSync(registryPath + ".tmp", JSON.stringify(registry, null, 2) + "\n");
  fs.renameSync(registryPath + ".tmp", registryPath);
  console.log(JSON.stringify({ imported: results.length, total: registry.entries.length }));
}
if (require.main === module) importArt(path.resolve(process.argv[2]));
module.exports = { importArt };
