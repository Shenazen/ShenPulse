"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");

function importSheets(resultsPath, sheetsPath = path.join(root, ".tmp/interaction-art-sheets.json")) {
  const sheets = new Map(JSON.parse(fs.readFileSync(sheetsPath, "utf8")).map(sheet => [sheet.id, sheet]));
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const converted = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-interaction-atlas-"));
  const pairs = [], imported = [];
  for (const result of results) {
    const sheet = sheets.get(result.id);
    if (!sheet || !fs.statSync(result.source).isFile()) throw new Error("Unknown atlas or missing generated file");
    sheet.entries.forEach((entry, index) => {
      if (entry.file !== `${entry.gameId}/${entry.effectId}.png` || !/^[a-z0-9_-]+\/[a-z0-9_-]+\.png$/i.test(entry.file)) throw new Error("Unsafe atlas path");
      const column = index % sheet.columns, row = Math.floor(index / sheet.columns);
      pairs.push([result.source, path.join(converted, entry.file), sheet.columns, sheet.rows, column, row].join("\t"));
      imported.push({ ...entry, sheet: sheet.id, cell: { column, row } });
    });
  }
  const list = path.join(converted, "files.tsv"); fs.writeFileSync(list, pairs.join("\n"));
  const compiler = path.join(process.env.WINDIR || "C:/Windows", "Microsoft.NET/Framework/v4.0.30319/csc.exe");
  const executable = path.join(converted, "Thumbnail.exe");
  for (const [command, args] of [
    [compiler, ["/nologo", "/reference:System.Drawing.dll", `/out:${executable}`, path.join(__dirname, "interaction-art-thumbnail.cs")]],
    [executable, [list]]
  ]) {
    const run = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
    if (run.status !== 0) throw new Error(run.stdout || run.stderr || "Atlas conversion failed");
  }
  const registryPath = path.join(root, "resources/catalogs/game-interaction-art.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const entries = new Map(registry.entries.map(entry => [`${entry.gameId}/${entry.effectId}`, entry]));
  registry.sheets ||= {};
  for (const result of results) {
    const sheet = sheets.get(result.id);
    registry.sheets[result.id] = { prompt: sheet.prompt, columns: sheet.columns, rows: sheet.rows, cells: sheet.entries.length,
      sourceSha256: createHash("sha256").update(fs.readFileSync(result.source)).digest("hex") };
  }
  for (const entry of imported) {
    const destination = path.join(root, "resources/game-interaction-art", entry.file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) throw new Error(`Artwork already exists; explicit replacement required: ${entry.file}`);
    fs.copyFileSync(path.join(converted, entry.file), destination);
    const { name, ...record } = entry;
    entries.set(`${entry.gameId}/${entry.effectId}`, { ...record, sha256: createHash("sha256").update(fs.readFileSync(destination)).digest("hex") });
  }
  registry.entries = [...entries.values()].sort((a, b) => `${a.gameId}/${a.effectId}`.localeCompare(`${b.gameId}/${b.effectId}`, "en"));
  fs.writeFileSync(registryPath + ".tmp", JSON.stringify(registry, null, 2) + "\n");
  fs.renameSync(registryPath + ".tmp", registryPath);
  console.log(JSON.stringify({ imported: imported.length, total: registry.entries.length }));
}
if (require.main === module) importSheets(path.resolve(process.argv[2]), process.argv[3] ? path.resolve(process.argv[3]) : undefined);
module.exports = { importSheets };
