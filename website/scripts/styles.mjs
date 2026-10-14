import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const sections = ["base", "accueil", "documentation", "jeux", "legal", "responsive"]

/** Une seule feuille livrée ; ordre de cascade conservé, sources organisées par page. */
export async function buildStyles({ write = true } = {}) {
  const sources = await Promise.all(sections.map((section) => readFile(path.join(root, "styles", section + ".css"), "utf8")))
  const css = "/* FICHIER GÉNÉRÉ — modifier styles/*.css puis reconstruire le site. */\n" + sources.join("\n").trimEnd() + "\n"
  if (write) await writeFile(path.join(root, "styles.css"), css)
  return css
}
