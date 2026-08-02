"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const roots = ["src", "scripts", "tests"];
const files = [];
const generatedDirectories = new Set([
  path.resolve("src", "renderer", "games", "original")
]);

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  if (generatedDirectories.has(path.resolve(directory))) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".js")) files.push(fullPath);
  }
}

roots.forEach(walk);
let failed = false;
for (const file of files) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    failed = true;
    process.stderr.write(`${file}\n${error.stack}\n`);
  }
}

if (failed) process.exit(1);
process.stdout.write(`Syntaxe valide : ${files.length} fichiers JavaScript.\n`);
