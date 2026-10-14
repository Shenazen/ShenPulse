"use strict";

const { architectureReport } = require("./lib/source-analysis");

/** Audit en lecture seule. --json fournit un inventaire exploitable ; aucun fichier n'est modifié. */
function main() {
  const report = architectureReport();
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const authored = report.files.filter((file) => !file.generated);
    process.stdout.write(`${authored.length} sources examinées, ${report.files.length - authored.length} bundles identifiés.\n`);
    process.stdout.write(`Erreurs de syntaxe : ${report.errors.length}. Cycles : ${report.cycles.length}.\n`);
    process.stdout.write("\nPlus gros fichiers sources :\n");
    for (const file of [...authored].sort((a, b) => b.lines - a.lines).slice(0, 30)) {
      process.stdout.write(`${file.lines.toString().padStart(5)} lignes  ${file.path}\n`);
    }
    process.stdout.write("\nCorps de fonctions aux mêmes tokens à examiner (pas de fusion automatique) :\n");
    for (const group of report.duplicates) {
      process.stdout.write(`${group[0].tokens} tokens : ${group.map((fn) => `${fn.path}:${fn.line} (${fn.name})`).join(" ; ")}\n`);
    }
    for (const cycle of report.cycles) process.stdout.write(`Cycle : ${cycle.join(" → ")}\n`);
    for (const error of report.errors) process.stderr.write(error + "\n");
  }
  if (report.errors.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { main };
